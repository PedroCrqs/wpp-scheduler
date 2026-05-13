const state = require("./state");
const { GENERAL_GROUPS } = require("./config");
const { sleep, shuffle, microVary } = require("./helpers");
const persistence = require("./persistence");
const { dailyReset, initResetScheduler } = require("./scheduler");
const { markAsSentInCycle } = require("./auto-scheduler");
const { INSTANCE } = require("./config");

function queueDispatch(index) {
  state.pendingDispatches.push(index);
  processDispatchQueue();
}

async function processDispatchQueue() {
  if (state.dispatchRunning) return;

  while (state.pendingDispatches.length > 0) {
    state.dispatchRunning = true;
    const index = state.pendingDispatches.shift();
    try {
      await executeDispatch(index);
    } catch (err) {
      await persistence.log(
        "ERROR",
        `Unhandled error in slot ${index + 1}: ${err.message}`,
      );
    } finally {
      state.dispatchRunning = false;
    }
  }
}

async function executeDispatch(index) {
  await persistence.log(
    "DISPATCH",
    `Starting slot ${index + 1} (${state.SCHEDULE[index] || "manual"})`,
  );

  if (index >= state.todayQueue.length) {
    await persistence.log(
      "WARN",
      `Slot ${index + 1}: no message in queue for this slot`,
    );
    return;
  }

  const message = state.todayQueue[index];

  if (message.status === "sent") {
    await persistence.log("WARN", `Slot ${index + 1}: already sent, skipping`);
    return;
  }
  if (message.status === "sending") {
    await persistence.log(
      "WARN",
      `Slot ${index + 1}: already in progress, skipping`,
    );
    return;
  }

  state.todayQueue[index].status = "sending";
  state.todayQueue[index].dispatchStartedAt = new Date().toISOString();
  await persistence.saveQueue();

  let successes = 0;
  let failures = 0;

  const targetGroups = shuffle(message.targetGroups || GENERAL_GROUPS);

  await persistence.log(
    "DISPATCH",
    `Slot ${index + 1} | neighborhood: ${message.neighborhood || "—"} | class: ${message.class || "GENERAL"} | ${targetGroups.length} groups`,
  );

  const client = state.client;

  for (let i = 0; i < targetGroups.length; i++) {
    const groupId = targetGroups[i];
    try {
      const chat = await client.getChatById(groupId);
      await chat.sendMessage(microVary(message.body));
      await persistence.log(
        "SENT",
        `Slot ${index + 1} → ${chat.name || groupId}`,
      );
      successes++;
      state.todayQueue[index].result = { successes, failures };
      await persistence.saveQueue();

      if ((i + 1) % 5 === 0) {
        await sleep(15000 + Math.random() * 20000);
      } else {
        await sleep(4000 + Math.random() * 8000);
      }
    } catch (err) {
      // Frame ID is dynamic per Chromium session — match by prefix only,
      // never hardcode the full ID or this check will never trigger.
      if (err.message.includes("Attempted to use detached Frame")) {
        await persistence.log(
          "ERROR",
          `Slot ${index + 1}: detached frame — aborting dispatch and exiting for restart`,
        );
        process.exit(1);
      }
      if (
        err.message.includes("net::ERR_NETWORK_CHANGED") ||
        err.message.includes("net::ERR_NAME_NOT_RESOLVED")
      ) {
        await persistence.log(
          "ERROR",
          `Slot ${index + 1}: network error — exiting for restart`,
        );
        process.exit(1);
      }
      await persistence.log(
        "ERROR",
        `Slot ${index + 1} → ${groupId}: ${err.message}`,
      );
      failures++;
    }
  }

  const dispatched = failures < targetGroups.length;

  state.todayQueue[index].status = dispatched ? "sent" : "error";
  state.todayQueue[index].dispatchedAt = new Date().toISOString();
  state.todayQueue[index].result = { successes, failures };
  state.dispatchesDone++;
  await persistence.saveQueue();

  await persistence.log(
    "DISPATCH",
    `Slot ${index + 1} done — ${successes} ok, ${failures} failed`,
  );

  // Marca o imóvel no ciclo apenas após envio confirmado (ao menos parcial).
  // Isso garante que falhas antes do envio não "queimem" o imóvel do ciclo.
  if (dispatched && message.sourceImovelID != null) {
    await markAsSentInCycle([message.sourceImovelID], INSTANCE);
  }

  if (!state.resetCronInitialized) {
    initResetScheduler();
  }

  try {
    const myId = client.info.wid._serialized;
    await client.sendMessage(
      myId,
      `📤 *Dispatch ${index + 1}/14 done* (${state.SCHEDULE[index] || "manual"})\n\n` +
        `✅ Sent to ${successes} group(s)\n` +
        (failures > 0 ? `❌ Failed in ${failures} group(s)\n` : "") +
        `📝 "${message.preview}"`,
    );
  } catch {}

  if (state.dispatchesDone === 14) {
    let loaded = 0;
    try {
      loaded = await dailyReset(false);
    } catch (resetErr) {
      await persistence.log(
        "ERROR",
        `Post-cycle reset failed: ${resetErr.message}`,
      );
    }
    try {
      const myId = client.info.wid._serialized;
      await client.sendMessage(
        myId,
        `🗑️ *Reset Triggered!*\n\n` +
          `📦 ${loaded} anúncio(s) carregados automaticamente do banco.`,
      );
    } catch (msgErr) {
      await persistence.log(
        "ERROR",
        `Post-reset message failed: ${msgErr.message}`,
      );
    }
  }
}

module.exports = { queueDispatch, processDispatchQueue, executeDispatch };
