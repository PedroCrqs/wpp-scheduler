const state = require("./state");
const persistence = require("./persistence");
const {
  dailyReset,
  generateSchedule,
  nextScheduledTime,
  scheduleDispatches,
} = require("./scheduler");
const { queueDispatch } = require("./dispatcher");
const { clearTodayReservations } = require("./auto-scheduler");

const STATUS_LABELS = {
  waiting: "aguardando",
  sending: "enviando",
  sent: "enviado",
  error: "erro",
};

async function handleReset(msg, reschedule = false) {
  const loaded = await dailyReset(reschedule);

  await msg.reply(
    `🗑️ *Reset manual executado!*\n\n` +
      `📦 ${loaded} anúncio(s) carregados automaticamente do banco de dados.\n` +
      `⏰ Novo cronograma: ${state.SCHEDULE.join(", ")}`,
  );
}

async function handleStatus(msg) {
  const status =
    `📊 *Status do Bot*\n\n` +
    `📨 Fila: ${state.todayQueue.length}/14\n` +
    `✅ Disparos realizados hoje: ${state.dispatchesDone}/${state.SCHEDULE.length}\n` +
    `⏳ Próximo disparo: ${nextScheduledTime()}\n\n` +
    `_Mensagens na fila:_\n` +
    state.todayQueue
      .map(
        (m, i) => `${i + 1}. [${STATUS_LABELS[m.status] || m.status}] ${m.preview}`,
      )
      .join("\n");
  await msg.reply(status);
}

async function handleClear(msg) {
  state.todayQueue = [];
  state.dispatchesDone = 0;
  state.processedMessages.clear();
  state.SCHEDULE = generateSchedule();
  state.scheduleDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  persistence.saveSchedule();
  await persistence.saveQueue();
  await scheduleDispatches();
  await msg.reply("🗑️ Fila limpa com sucesso.");
  await persistence.log("COMMAND", "Fila limpa manualmente");
}

async function handleGroups(client, msg) {
  const chats = await client.getChats();
  const groups = chats.filter((c) => c.isGroup);
  const list = groups
    .map((g) => `• ${g.name}\n  ID: \`${g.id._serialized}\``)
    .join("\n\n");
  await msg.reply(`📋 *Grupos disponíveis:*\n\n${list}`);
}

async function handleFire(msg) {
  const parts = msg.body.split(" ");
  let targetIndex;

  if (parts.length === 1) {
    targetIndex = state.todayQueue.findIndex((m) => m.status === "waiting");
  } else {
    const n = parseInt(parts[1], 10);
    if (isNaN(n) || n < 1 || n > state.todayQueue.length) {
      await msg.reply(
        `⚠️ Slot inválido. Use *!disparar* ou *!disparar <1–${state.todayQueue.length}>*.`,
      );
      return;
    }
    targetIndex = n - 1;
  }

  if (targetIndex === -1 || targetIndex === undefined || targetIndex === null) {
    await msg.reply("⚠️ Nenhuma mensagem pendente na fila.");
    return;
  }

  const target = state.todayQueue[targetIndex];
  if (!target) {
    await msg.reply(`⚠️ Slot ${targetIndex + 1} não encontrado na fila.`);
    return;
  }
  if (target.status === "sent") {
    await msg.reply(`⚠️ Slot ${targetIndex + 1} já foi enviado.`);
    return;
  }
  if (target.status === "sending") {
    await msg.reply(
      `⚠️ Slot ${targetIndex + 1} está sendo disparado no momento.`,
    );
    return;
  }

  await msg.reply(`📤 Disparando slot ${targetIndex + 1} agora...`);
  await persistence.log(
    "COMMAND",
    `Disparo manual solicitado para o slot ${targetIndex + 1}`,
  );
  queueDispatch(targetIndex);
}

async function handleStopMidnightReset(msg) {
  state.resetCronTask.destroy();
  state.resetCronTask = null;
  state.resetCronInitialized = false;
  await msg.reply("🛑 Reset diário da meia-noite interrompido.");
  await persistence.log("COMMAND", "Cron de reset da meia-noite interrompido manualmente");
}

async function handleResetReservedToday(msg) {
  await clearTodayReservations();
  await msg.reply("🗑️ Reservas de hoje limpas com sucesso.");
}

module.exports = {
  handleClear,
  handleFire,
  handleGroups,
  handleStatus,
  handleStopMidnightReset,
  handleReset,
  handleResetReservedToday,
};
