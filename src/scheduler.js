const cron = require("node-cron");
const state = require("./state");
const persistence = require("./persistence");

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
    const jitter = Math.floor(Math.random() * 30); // 0–29 min
    const newMinute = minute + jitter;
    return `${String(hour).padStart(2, "0")}:${String(newMinute).padStart(2, "0")}`;
  });
}

function nextScheduledTime() {
  const hhmm = new Date()
    .toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "")
    .trim();
  const next = state.SCHEDULE.find((h) => h > hhmm);
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
  state.todayQueue = [];
  state.dispatchesDone = 0;
  state.processedMessages.clear();
  state.pendingDispatches = [];
  state.dispatchRunning = false;
  state.SCHEDULE = generateSchedule();
  persistence.saveSchedule();
  await persistence.saveQueue();
  await persistence.log(
    "RESET",
    `Queue and counters cleared | New schedule: ${state.SCHEDULE.join(", ")}`,
  );
  await scheduleDispatches();
}

function checkMissedDispatches() {
  const { queueDispatch } = require("./dispatcher");

  const nowSP = new Date()
    .toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "")
    .trim();

  if (nowSP < "09:00" || nowSP >= "19:00") return;

  state.SCHEDULE.forEach((time, index) => {
    if (time < nowSP) {
      const msg = state.todayQueue[index];
      if (msg && msg.status === "waiting") {
        persistence.log(
          "WATCHDOG",
          `Slot ${index + 1} (${time}) overdue — firing now`,
        );
        queueDispatch(index);
      }
    }
  });
}

module.exports = {
  generateSchedule,
  nextScheduledTime,
  scheduleDispatches,
  dailyReset,
  checkMissedDispatches,
};
