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
        `Erro não tratado no slot ${index + 1}: ${err.message}`,
      );
    } finally {
      state.dispatchRunning = false;
    }
  }
}

async function executeDispatch(index) {
  await persistence.log(
    "DISPATCH",
    `Iniciando slot ${index + 1} (${state.SCHEDULE[index] || "manual"})`,
  );

  if (index >= state.todayQueue.length) {
    await persistence.log(
      "WARN",
      `Slot ${index + 1}: nenhuma mensagem na fila para este slot`,
    );
    return;
  }

  const message = state.todayQueue[index];

  if (message.status === "sent") {
    await persistence.log("WARN", `Slot ${index + 1}: já enviado, ignorando`);
    return;
  }
  if (message.status === "sending") {
    await persistence.log(
      "WARN",
      `Slot ${index + 1}: já em andamento, ignorando`,
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
    `Slot ${index + 1} | bairro: ${message.neighborhood || "—"} | classe: ${message.class || "GENERAL"} | ${targetGroups.length} grupos`,
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
      // O ID do frame é dinâmico por sessão do Chromium — verificar apenas por prefixo,
      // nunca usar o ID completo fixo ou esta validação nunca será acionada.
      if (err.message.includes("Attempted to use detached Frame")) {
        await persistence.log(
          "ERROR",
          `Slot ${index + 1}: frame desconectado — abortando disparo e encerrando para reinicialização`,
        );
        process.exit(1);
      }
      if (
        err.message.includes("net::ERR_NETWORK_CHANGED") ||
        err.message.includes("net::ERR_NAME_NOT_RESOLVED")
      ) {
        await persistence.log(
          "ERROR",
          `Slot ${index + 1}: erro de rede — encerrando para reinicialização`,
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
    `Slot ${index + 1} concluído — ${successes} ok, ${failures} com falha`,
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
      `📤 *Disparo ${index + 1}/14 concluído* (${state.SCHEDULE[index] || "manual"})\n\n` +
        `✅ Enviado para ${successes} grupo(s)\n` +
        (failures > 0 ? `❌ Falha em ${failures} grupo(s)\n` : "") +
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
        `Falha no reset pós-ciclo: ${resetErr.message}`,
      );
    }
    try {
      const myId = client.info.wid._serialized;
      await client.sendMessage(
        myId,
        `🗑️ *Reset Acionado!*\n\n` +
          `📦 ${loaded} anúncio(s) carregados automaticamente do banco.`,
      );
    } catch (msgErr) {
      await persistence.log(
        "ERROR",
        `Falha no envio da mensagem pós-reset: ${msgErr.message}`,
      );
    }
  }
}

module.exports = { queueDispatch, processDispatchQueue, executeDispatch };
