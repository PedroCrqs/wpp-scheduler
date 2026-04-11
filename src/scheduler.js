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
    const jitter = Math.floor(Math.random() * 46);
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

async function dailyReset(reschedule = true) {
  await persistence.log("RESET", "Daily reset triggered");

  if (state.resetCronTask) {
    state.resetCronTask.destroy();
    state.resetCronTask = null;
    state.resetCronInitialized = false;
  }

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

  if (reschedule) {
    initResetScheduler();
  }
}

async function checkMissedDispatches() {
  const { queueDispatch } = require("./dispatcher");

  const todaySP = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  const current = nowSP();

  // 🔒 Gate por data (evita replay de dias antigos ou futuros)
  if (state.scheduleDate !== todaySP) {
    await persistence.log(
      "WATCHDOG",
      "Schedule date mismatch — skipping missed slot recovery",
    );
    return;
  }

  // 🔒 Evita execução fora da janela operacional
  if (current < "09:00" || current >= "19:00") return;

  state.SCHEDULE.forEach((time, index) => {
    // ⛔ Só olha slots já passados
    if (time >= current) return;

    const msg = state.todayQueue[index];

    // ⛔ Nada pra enviar ou já processado
    if (!msg || msg.status !== "waiting") return;

    // ⛔ Já foi agendado pelo watchdog
    if (state.watchdogScheduled.has(index)) return;

    // 🔗 Garante ordem: só dispara se o anterior terminou
    if (index > 0) {
      const prev = state.todayQueue[index - 1];
      if (prev && prev.status !== "sent" && prev.status !== "error") {
        return;
      }
    }

    state.watchdogScheduled.add(index);

    const isFirstMissed = state.watchdogScheduled.size === 1;

    if (isFirstMissed) {
      // 🚀 Primeiro atraso do dia → execução imediata
      persistence.log(
        "WATCHDOG",
        `Slot ${index + 1} (${time}) overdue — firing immediately`,
      );
      queueDispatch(index);
    } else {
      // 🧠 Delay inteligente (20–30min com jitter)
      const delayMinutes = Math.floor(Math.random() * 11) + 20;
      const delayMs = delayMinutes * 60 * 1000;

      persistence.log(
        "WATCHDOG",
        `Slot ${index + 1} (${time}) overdue — scheduling in ${delayMinutes}min`,
      );

      setTimeout(() => {
        const currentMsg = state.todayQueue[index];

        // 🔁 Revalidação antes de disparar
        if (currentMsg && currentMsg.status === "waiting") {
          persistence.log(
            "WATCHDOG",
            `Slot ${index + 1} (${time}) firing after delay`,
          );
          queueDispatch(index);
        }
      }, delayMs);
    }
  });
}

function initResetScheduler() {
  if (state.resetCronInitialized) return;

  const task = cron.schedule(
    "0 20 * * *",
    async () => {
      await persistence.log("RESET", "Daily reset triggered by cron (20:00)");
      await dailyReset();
    },
    { timezone: "America/Sao_Paulo" },
  );

  state.resetCronTask = task;
  state.resetCronInitialized = true;
}

module.exports = {
  generateSchedule,
  nextScheduledTime,
  scheduleDispatches,
  dailyReset,
  checkMissedDispatches,
  initResetScheduler,
};
