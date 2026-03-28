const state = require("./state");
const { GENERAL_GROUPS } = require("./config");
const { sleep, shuffle, microVary } = require("./helpers");
const persistence = require("./persistence");

function queueDispatch(index) {
  state.pendingDispatches.push(index);
  processDispatchQueue();
}

async function processDispatchQueue() {
  // Se já há um disparo em andamento, aguarda — será retomado ao final do atual
  if (state.dispatchRunning) return;

  // Loop para drenar toda a fila sem recursão (evita race condition)
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
    await persistence.log("WARN", `Slot ${index + 1}: no message in queue for this slot`);
    return;
  }

  const message = state.todayQueue[index];

  // Proteção dupla contra disparo duplicado
  if (message.status === "sent") {
    await persistence.log("WARN", `Slot ${index + 1}: already sent, skipping`);
    return;
  }
  if (message.status === "sending") {
    await persistence.log("WARN", `Slot ${index + 1}: already in progress, skipping`);
    return;
  }

  // Marca como "sending" imediatamente para bloquear chamadas simultâneas
  state.todayQueue[index].status = "sending";
  await persistence.saveQueue();

  let successes = 0;
  let failures = 0;

  // ANTI-BAN: embaralha a ordem de envio dos grupos
  const targetGroups = shuffle(message.targetGroups || GENERAL_GROUPS);

  await persistence.log(
    "DISPATCH",
    `Slot ${index + 1} | neighborhood: ${message.neighborhood || "—"} | class: ${message.class || "GENERAL"} | ${targetGroups.length} groups`,
  );

  // state.client é definido em src/client.js após a criação do Client
  const client = state.client;

  for (let i = 0; i < targetGroups.length; i++) {
    const groupId = targetGroups[i];
    try {
      const chat = await client.getChatById(groupId);
      // ANTI-BAN: micro variação no texto para evitar detecção de duplicata pela META
      await chat.sendMessage(microVary(message.body));
      await persistence.log("SENT", `Slot ${index + 1} → ${chat.name || groupId}`);
      successes++;

      // ANTI-BAN: pausa longa a cada 5 envios
      if ((i + 1) % 5 === 0) {
        await sleep(15000 + Math.random() * 20000); // 15–35s
      } else {
        // ANTI-BAN: delay variável entre envios individuais
        await sleep(4000 + Math.random() * 8000); // 4–12s
      }
    } catch (err) {
      await persistence.log("ERROR", `Slot ${index + 1} → ${groupId}: ${err.message}`);
      failures++;
    }
  }

  // Atualiza estado e incrementa contador UMA única vez, fora do loop
  state.todayQueue[index].status =
    failures === targetGroups.length ? "error" : "sent";
  state.todayQueue[index].dispatchedAt = new Date().toISOString();
  state.todayQueue[index].result = { successes, failures };
  state.dispatchesDone++;
  await persistence.saveQueue();

  await persistence.log(
    "DISPATCH",
    `Slot ${index + 1} done — ${successes} ok, ${failures} failed`,
  );

  // Notifica via mensagem para si mesmo
  try {
    const myId = client.info.wid._serialized;
    await client.sendMessage(
      myId,
      `📤 *Dispatch ${index + 1}/10 done* (${state.SCHEDULE[index] || "manual"})\n\n` +
        `✅ Sent to ${successes} group(s)\n` +
        (failures > 0 ? `❌ Failed in ${failures} group(s)\n` : "") +
        `📝 "${message.preview}"`,
    );
  } catch {}
}

module.exports = { queueDispatch, processDispatchQueue, executeDispatch };

