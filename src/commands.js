async function handleStatus(msg) {
  if (msg === "!status") {
    const status =
      `📊 *Bot Status*\n\n` +
      `📨 Queue: ${todayQueue.length}/10\n` +
      `✅ Dispatches done today: ${dispatchesDone}/${SCHEDULE.length}\n` +
      `⏳ Next dispatch: ${nextScheduledTime()}\n\n` +
      `_Queued messages:_\n` +
      todayQueue
        .map((m, i) => `${i + 1}. [${m.status}] ${m.preview}`)
        .join("\n");
    await msg.reply(status);
    return;
  }
}

async function handleClear(msg) {
  if (msg === "!clear") {
    state.todayQueue = [];
    state.dispatchesDone = 0;
    state.processedMessages.clear();
    state.SCHEDULE = generateSchedule();
    saveSchedule();
    await saveQueue();
    scheduleDispatches();
    await msg.reply("🗑️ Queue cleared successfully.");
    await log("COMMAND", "Queue manually cleared");
  }
}

async function handleGroups(client, msg) {
  if (msg === "!groups") {
    const chats = await client.getChats();
    const groups = chats.filter((c) => c.isGroup);
    const list = groups
      .map((g) => `• ${g.name}\n  ID: \`${g.id._serialized}\``)
      .join("\n\n");
    await msg.reply(`📋 *Available groups:*\n\n${list}`);
    return;
  }
}

async function handleFire(msg) {
  if (msg.startsWith("!fire")) {
    const parts = msg.split(" ");
    let targetIndex;

    if (parts.length === 1) {
      targetIndex = todayQueue.findIndex((m) => m.status === "waiting");
    } else {
      const n = parseInt(parts[1], 10);
      if (isNaN(n) || n < 1 || n > todayQueue.length) {
        await msg.reply(
          `⚠️ Invalid slot. Use *!fire* or *!fire <1–${todayQueue.length}>*.`,
        );
        return;
      }
      targetIndex = n - 1;
    }

    if (
      targetIndex === -1 ||
      targetIndex === undefined ||
      targetIndex === null
    ) {
      await msg.reply("⚠️ No pending messages in queue.");
      return;
    }

    const target = todayQueue[targetIndex];
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
    await log("COMMAND", `Manual fire requested for slot ${targetIndex + 1}`);
    queueDispatch(targetIndex);
    return;
  }
}

module.exports = { handleClear, handleFire, handleGroups, handleStatus };
