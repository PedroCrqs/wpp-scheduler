const cron = require("node-cron");
const state = require("./state");
const persistence = require("./persistence");
const {
  fetchAndReserveAnnouncements,
  pruneOldReservations,
} = require("./auto-scheduler");

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
    { hour: 19, minute: 0 },
    { hour: 20, minute: 0 },
    { hour: 21, minute: 0 },
    { hour: 22, minute: 0 },
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
  return next || "Nenhum hoje (todos concluídos)";
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
          `Disparo agendado para o slot ${index + 1} (${time})`,
        );
        queueDispatch(index);
      },
      { timezone: "America/Sao_Paulo" },
    );

    state.slotCronTasks.push(task);
  });

  await persistence.log("CRON", `${state.SCHEDULE.length} slots agendados ✓`);
}

async function autoFeedQueue() {
  // A coordenação entre instâncias (evitar reservar o mesmo imóvel duas
  // vezes) agora é feita dentro de fetchAndReserveAnnouncements, via
  // transação Postgres com ON CONFLICT DO NOTHING — não precisa mais de
  // lock de arquivo nem de baixar/subir o banco do Drive antes de rodar.
  await pruneOldReservations();
  const entries = await fetchAndReserveAnnouncements(14);

  if (entries.length === 0) {
    await persistence.log(
      "AUTO-SCHEDULER",
      "Fila vazia — nenhum anúncio disponível.",
    );
    return 0;
  }

  entries.forEach((e, i) => {
    e.index = i;
  });

  state.todayQueue = entries;
  state.dispatchesDone = 0;
  await persistence.saveQueue();

  await persistence.log(
    "AUTO-SCHEDULER",
    `Fila preenchida com ${entries.length} anúncio(s).`,
  );

  return entries.length;
}

async function dailyReset(reschedule = true) {
  await persistence.log("RESET", "Reset diário acionado");

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
  state.watchdogScheduled = new Set();

  state.SCHEDULE = generateSchedule();
  state.scheduleDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  await persistence.saveSchedule();

  const loaded = await autoFeedQueue();

  await persistence.log(
    "RESET",
    `Fila limpa | Novo cronograma: ${state.SCHEDULE.join(", ")} | ${loaded} anúncio(s) carregados`,
  );

  await scheduleDispatches();

  if (reschedule) initResetScheduler();

  return loaded;
}

async function checkMissedDispatches() {
  const { queueDispatch } = require("./dispatcher");

  const todaySP = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const current = nowSP();

  if (!state.scheduleDate) return;
  // if (!state.scheduleDate || state.scheduleDate !== todaySP) return;
  // A verificação scheduleData !== todaySP está bloqueando o WATCHDOG

  if (current < "09:00" || current >= "22:00") return;

  state.SCHEDULE.forEach((time, index) => {
    if (time >= current) return;

    const msg = state.todayQueue[index];
    if (!msg || msg.status !== "waiting") return;
    if (state.watchdogScheduled.has(index)) return;

    if (index > 0) {
      const prev = state.todayQueue[index - 1];
      if (prev && prev.status !== "sent" && prev.status !== "error") return;
    }

    state.watchdogScheduled.add(index);
    const isFirstMissed = state.watchdogScheduled.size === 1;

    if (isFirstMissed) {
      persistence.log(
        "WATCHDOG",
        `Slot ${index + 1} (${time}) atrasado — disparando imediatamente`,
      );
      queueDispatch(index);
    } else {
      const delayMinutes = Math.floor(Math.random() * 11) + 20;
      persistence.log(
        "WATCHDOG",
        `Slot ${index + 1} (${time}) atrasado — agendando em ${delayMinutes}min`,
      );
      setTimeout(
        () => {
          const currentMsg = state.todayQueue[index];
          if (currentMsg && currentMsg.status === "waiting") {
            persistence.log(
              "WATCHDOG",
              `Slot ${index + 1} (${time}) disparando após atraso programado`,
            );
            queueDispatch(index);
          }
        },
        delayMinutes * 60 * 1000,
      );
    }
  });
}

function initResetScheduler() {
  if (state.resetCronInitialized) return;

  const task = cron.schedule(
    "0 0 * * *",
    async () => {
      await persistence.log("RESET", "Reset diário acionado pelo cron (00:00)");
      const loaded = await dailyReset();
      try {
        const myId = state.client.info.wid._serialized;
        await state.client.sendMessage(
          myId,
          `🗑️ *Reset Diário Acionado!*\n\n` +
            `📦 ${loaded} anúncio(s) carregados automaticamente do banco de dados.\n` +
            `⏰ Novo cronograma: ${state.SCHEDULE.join(", ")}`,
        );
      } catch {}
    },
    { timezone: "America/Sao_Paulo" },
  );

  state.resetCronTask = task;
  state.resetCronInitialized = true;
}

// TODO: implementar backupSessionFolder
// async function backupSessionFolder(instance) { }

// const task = cron.schedule("*/30 * * * *", async () => {
//   if (!state.client || !clientIsReady) return;
//   await backupSessionFolder(INSTANCE); // copia pra session-backup-{instance}-{timestamp}, mantém últimas 3
// });

module.exports = {
  generateSchedule,
  nextScheduledTime,
  scheduleDispatches,
  dailyReset,
  checkMissedDispatches,
  initResetScheduler,
  autoFeedQueue,
};
