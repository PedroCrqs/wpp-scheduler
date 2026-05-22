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

async function handleReset(msg, reschedule = false) {
  const loaded = await dailyReset(reschedule);

  await msg.reply(
    `🗑️ *Manual reset executed!*\n\n` +
      `📦 ${loaded} ad(s) automatically loaded from the database.\n` +
      `⏰ New schedule: ${state.SCHEDULE.join(", ")}`,
  );
}

async function handleStatus(msg) {
  const status =
    `📊 *Bot Status*\n\n` +
    `📨 Queue: ${state.todayQueue.length}/14\n` +
    `✅ Dispatches done today: ${state.dispatchesDone}/${state.SCHEDULE.length}\n` +
    `⏳ Next dispatch: ${nextScheduledTime()}\n\n` +
    `_Queued messages:_\n` +
    state.todayQueue
      .map((m, i) => `${i + 1}. [${m.status}] ${m.preview}`)
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
  await msg.reply("🗑️ Queue cleared successfully.");
  await persistence.log("COMMAND", "Queue manually cleared");
}

async function handleGroups(client, msg) {
  const chats = await client.getChats();
  const groups = chats.filter((c) => c.isGroup);
  const list = groups
    .map((g) => `• ${g.name}\n  ID: \`${g.id._serialized}\``)
    .join("\n\n");
  await msg.reply(`📋 *Available groups:*\n\n${list}`);
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
        `⚠️ Invalid slot. Use *!fire* or *!fire <1–${state.todayQueue.length}>*.`,
      );
      return;
    }
    targetIndex = n - 1;
  }

  if (targetIndex === -1 || targetIndex === undefined || targetIndex === null) {
    await msg.reply("⚠️ No pending messages in queue.");
    return;
  }

  const target = state.todayQueue[targetIndex];
  if (!target) {
    await msg.reply(`⚠️ Slot ${targetIndex + 1} not found in queue.`);
    return;
  }
  if (target.status === "sent") {
    await msg.reply(`⚠️ Slot ${targetIndex + 1} already sent.`);
    return;
  }
  if (target.status === "sending") {
    await msg.reply(
      `⚠️ Slot ${targetIndex + 1} is currently being dispatched.`,
    );
    return;
  }

  await msg.reply(`📤 Firing slot ${targetIndex + 1} now...`);
  await persistence.log(
    "COMMAND",
    `Manual fire requested for slot ${targetIndex + 1}`,
  );
  queueDispatch(targetIndex);
}

async function handleStopMidnightReset(msg) {
  state.resetCronTask.destroy();
  state.resetCronTask = null;
  state.resetCronInitialized = false;
  await msg.reply("🛑 Daily midnight reset stopped.");
  await persistence.log("COMMAND", "Midnight reset cron manually stopped");
}

async function handleResetReservedToday(msg) {
  await clearTodayReservations();
  await msg.reply("🗑️ Today reservations cleared successfully.");
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
