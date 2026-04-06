const cron = require("node-cron");
const state = require("./state");
const persistence = require("./persistence");

function nowSP() {
  return new Date()
    .toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "")
    .trim();
}

function msUntilSP(hh, mm) {
  const now = new Date();
  const sp = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  sp.setHours(hh, mm, 0, 0);
  let diff = sp - now;
  if (diff <= 0) diff += 24 * 60 * 60 * 1000;
  return diff;
}

function generateSchedule() {
  const base = [
    { hour: 9, minute: 0 },
    { hour: 10, minute: 0 },
    { hour: 11, minute: 0 },
    { hour: 12, minute: 0 },
    { hour: 13, minute: 0 },
    { hour: 14, minute: 0 },
    { hour: 15, minute: 0 },
    { hour: 16, minute: 0 },
    { hour: 17, minute: 0 },
    { hour: 18, minute: 0 },
  ];
  return base.map(({ hour, minute }) => {
    const jitter = Math.floor(Math.random() * 46); // 0–45 min
    const newMinute = minute + jitter;
    return `${String(hour).padStart(2, "0")}:${String(newMinute).padStart(2, "0")}`;
  });
}

function nextScheduledTime() {
  const current = nowSP();
  const next = state.SCHEDULE.find((h) => h > current);
  return next || "None today (all passed)";
}

async function scheduleDispatches() {
  const { queueDispatch } = require("./dispatcher");

  state.slotCronTasks.forEach((task) => task.destroy());
  state.slotCronTasks = [];

  state.SCHEDULE.forEach((time, index) => {
    const [hour, minute] = time.split(":");
    const expression = `${minute} ${hour} * * *`;

    const task = cron.schedule(
      expression,
      async () => {
        await persistence.log(
          "CRON",
          `Trigger for slot ${index + 1} (${time})`,
        );
        queueDispatch(index);
      },
      { timezone: "America/Sao_Paulo" },
    );

    state.slotCronTasks.push(task);
  });

  await persistence.log("CRON", `${state.SCHEDULE.length} slots scheduled ✓`);
}

async function dailyReset() {
  await persistence.log("RESET", "Daily reset triggered (19:00 SP)");

  state.todayQueue = [];
  state.dispatchesDone = 0;
  state.processedMessages.clear();
  state.pendingDispatches = [];
  state.dispatchRunning = false;
  state.SCHEDULE = generateSchedule();
  state.watchdogScheduled = new Set();
  await persistence.saveSchedule();
  await persistence.saveQueue();
  await persistence.log(
    "RESET",
    `Queue and counters cleared | New schedule: ${state.SCHEDULE.join(", ")}`,
  );
  await scheduleDispatches();

  scheduleNextReset();
}

function scheduleNextReset() {
  const RESET_HOUR = 19;
  const RESET_MIN = 0;

  const delay = msUntilSP(RESET_HOUR, RESET_MIN);

  if (state.resetTimer) {
    clearTimeout(state.resetTimer);
    state.resetTimer = null;
  }

  persistence.log(
    "RESET",
    `Next daily reset scheduled in ${Math.round(delay / 60000)} min`,
  );

  state.resetTimer = setTimeout(async () => {
    state.resetTimer = null;

    const current = nowSP();
    if (current < "19:00") {
      persistence.log(
        "RESET",
        `setTimeout fired early (now ${current}) — retrying in 60s`,
      );
      state.resetTimer = setTimeout(scheduleNextReset, 60_000);
      return;
    }

    if (state.resetFiredAt === current.slice(0, 5)) {
      persistence.log("RESET", `Reset already fired at ${current} — skipping`);
      scheduleNextReset();
      return;
    }
    state.resetFiredAt = current.slice(0, 5); // "19:00"

    await dailyReset();
  }, delay);
}

function initResetScheduler() {
  if (state.resetSchedulerInitialized) return;
  state.resetSchedulerInitialized = true;
  scheduleNextReset();
}

function checkMissedDispatches() {
  const { queueDispatch } = require("./dispatcher");

  const current = nowSP();
  if (current < "09:00" || current >= "19:00") return;

  state.SCHEDULE.forEach((time, index) => {
    if (time >= current) return;

    const msg = state.todayQueue[index];

    if (!msg || msg.status !== "waiting") return;

    if (state.watchdogScheduled.has(index)) return;

    if (index > 0) {
      const prev = state.todayQueue[index - 1];
      if (prev && prev.status !== "sent" && prev.status !== "error") {
        return;
      }
    }

    state.watchdogScheduled.add(index);

    const isFirstMissed = state.watchdogScheduled.size === 1;

    if (isFirstMissed) {
      persistence.log(
        "WATCHDOG",
        `Slot ${index + 1} (${time}) overdue – firing immediately (first miss of the day)`,
      );
      queueDispatch(index);
    } else {
      const delayMinutes = Math.floor(Math.random() * 11) + 20;
      const delayMs = delayMinutes * 60 * 1000;

      persistence.log(
        "WATCHDOG",
        `Slot ${index + 1} (${time}) overdue – firing in ${delayMinutes}min`,
      );

      setTimeout(() => {
        const currentMsg = state.todayQueue[index];
        if (currentMsg && currentMsg.status === "waiting") {
          persistence.log(
            "WATCHDOG",
            `Slot ${index + 1} (${time}) firing now after ${delayMinutes}min delay`,
          );
          queueDispatch(index);
        }
      }, delayMs);
    }
  });
}

module.exports = {
  generateSchedule,
  nextScheduledTime,
  scheduleDispatches,
  dailyReset,
  checkMissedDispatches,
  initResetScheduler,
};
