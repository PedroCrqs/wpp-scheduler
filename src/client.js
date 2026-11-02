const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const cron = require("node-cron");
const state = require("./state");
const { INSTANCE, ACCOUNTS, SESSIONS_DIR } = require("./config");
const persistence = require("./persistence");
const {
  generateSchedule,
  scheduleDispatches,
  checkMissedDispatches,
  initResetScheduler,
  autoFeedQueue,
} = require("./scheduler");
const { queueDispatch } = require("./dispatcher");
const {
  extractNeighborhood,
  classifyNeighborhood,
  resolveGroups,
} = require("./neighborhood");
const {
  handleStatus,
  handleClear,
  handleGroups,
  handleFire,
  handleStopMidnightReset,
  handleReset,
  handleResetReservedToday,
} = require("./commands");
const { mergeFormat, mergeFormat2 } = require("./format");

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: `scheduler-bot-${INSTANCE}`,
    dataPath: SESSIONS_DIR,
  }),
  // Força uma versão estável e mantida pela comunidade atualizada
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1014589918-alpha.html',
  },
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--no-first-run",
      "--disable-gpu",
      "--disable-software-rasterizer",
    ],
  },
});

state.client = client;

async function startBot() {
  try {
    await persistence.log("BOT", "Iniciando cliente WhatsApp...");
    await client.initialize();
  } catch (err) {
    await persistence.log(
      "ERROR",
      `Falha na inicialização: ${err.message}. Tentando novamente em 30s...`,
    );
    // NOTA: setTimeout recebe a referência da função, não seu valor de retorno
    setTimeout(startBot, 30000);
  }
}

client.on("qr", (qr) => {
  console.log("\n══════════════════════════════════════════");
  console.log("  Escaneie o QR Code abaixo com o WhatsApp");
  console.log("══════════════════════════════════════════\n");
  qrcode.generate(qr, { small: true });
});

client.once("ready", async () => {
  await persistence.log("BOT", "Cliente WhatsApp pronto ✓");
  state.myBsuid = ACCOUNTS[INSTANCE].myBsuid;
  console.log("BSUID:", state.myBsuid);

  // Adicione estes ouvintes ANTES do client.initialize() para debugar a transição:
  client.on("authenticated", async () => {
    await persistence.log("BOT", "WhatsApp autenticado, carregando sessão...");
  });

  // Proteção para evitar erros em encerramentos controlados
  process.on("SIGTERM", async () => {
    await persistence.log("BOT", "SIGTERM recebido — encerrando sessão graciosamente");
    await client.destroy();
    process.exit(0);
  });

  // Carrega fila salva em disco
  state.todayQueue = persistence.loadQueue();
  state.dispatchesDone = state.todayQueue.filter(
    (m) => m.status === "sent",
  ).length;

  // Carrega ou gera cronograma de agendamentos
  const savedSchedule = persistence.loadSchedule();
  if (savedSchedule) {
    state.SCHEDULE = savedSchedule.slots;
    state.scheduleDate = savedSchedule.date;
    await persistence.log(
      "BOT",
      `Cronograma carregado do disco: ${state.SCHEDULE.join(", ")}`,
    );
  } else {
    state.SCHEDULE = generateSchedule();
    state.scheduleDate = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });
    persistence.saveSchedule();
    await persistence.log(
      "BOT",
      `Cronograma gerado: ${state.SCHEDULE.join(", ")}`,
    );
  }

  await persistence.log(
    "BOT",
    `Fila: ${state.todayQueue.length} mensagem(ns) | ${state.dispatchesDone} já disparada(s)`,
  );

  // Recupera slots travados em "sending" antes de verificar se a fila está vazia
  await persistence.recoverSendingSlots();

  // Auto-alimentação no boot: se a fila continuar vazia após a recuperação, busca do banco de dados
  if (state.todayQueue.length === 0) {
    await persistence.log(
      "BOT",
      "Fila vazia no boot — iniciando auto-feed do banco…",
    );
    const loaded = await autoFeedQueue();
    await persistence.log(
      "BOT",
      `Auto-feed no boot: ${loaded} anúncio(s) carregados.`,
    );
  }

  await scheduleDispatches();

  if (!state.resetCronInitialized) {
    initResetScheduler();
  }

  cron.schedule("* * * * *", checkMissedDispatches, {
    timezone: "America/Sao_Paulo",
  });
});

// ─── Eventos de sessão ───────────────────────────────────────────────────────
client.on("auth_failure", (msg) => {
  persistence.log("ERROR", `Falha de autenticação: ${msg}`);
  setTimeout(startBot, 30000);
});

client.on("disconnected", (reason) => {
  persistence.log("WARN", `Desconectado: ${reason}`);
});

// ─── Recebimento de mensagens ────────────────────────────────────────────────
client.on("message_create", async (msg) => {
  const myId = client.info.wid._serialized;

  if (!msg.fromMe || (msg.to !== state.myBsuid && msg.to !== myId)) return;

  const botPrefixes = ["✅", "⚠️", "📊", "🗑️", "📋", "📤", "🔺", "🛑"];
  if (botPrefixes.some((p) => msg.body.startsWith(p))) return;

  const msgId = msg.id._serialized;
  if (state.processedMessages.has(msgId)) return;
  state.processedMessages.add(msgId);

  // ── Comandos ──────────────────────────────────────────────────────────────
  if (msg.body === "!status") {
    await handleStatus(msg);
    return;
  }
  if (msg.body === "!limpar" || msg.body === "!clear") {
    await handleClear(msg);
    return;
  }
  if (msg.body === "!grupos" || msg.body === "!groups") {
    await handleGroups(client, msg);
    return;
  }
  if (msg.body.startsWith("!disparar") || msg.body.startsWith("!fire")) {
    await handleFire(msg);
    return;
  }
  if (
    msg.body.startsWith("!parar-reinicio") ||
    msg.body.startsWith("!pararreinicio") ||
    msg.body.startsWith("!stopreset") ||
    msg.body.startsWith("!stopMidnightReset")
  ) {
    await handleStopMidnightReset(msg);
    return;
  }
  if (
    msg.body.startsWith("!reiniciar --reagendar") ||
    msg.body.startsWith("!reiniciar --reschedule") ||
    msg.body.startsWith("!reset --reschedule") ||
    msg.body.startsWith("!reset --reagendar")
  ) {
    await handleReset(msg, true);
    return;
  }
  if (msg.body.startsWith("!reiniciar") || msg.body.startsWith("!reset")) {
    await handleReset(msg, false);
    return;
  }
  if (
    msg.body.startsWith("!limpar-reservas") ||
    msg.body.startsWith("!limparreservas") ||
    msg.body.startsWith("!clearReservations")
  ) {
    await handleResetReservedToday(msg);
    return;
  }

  // ── Limite de fila ────────────────────────────────────────────────────────
  if (state.todayQueue.length >= 14) {
    await msg.reply("⚠️ Fila cheia (14/14). Envie *!limpar* para redefinir.");
    return;
  }

  // ── Entrada manual (fluxo legado — substituído pelo auto-feed no boot/reset) ──
  const neighborhood = extractNeighborhood(msg.body);
  const announcementCls = classifyNeighborhood(neighborhood);
  const targetGroups = resolveGroups(announcementCls);
  const previewMatch = msg.body.match(/\*•[^\n]+\* - _[^\n]+_/);

  const entry = {
    index: state.todayQueue.length,
    body:
      INSTANCE === "account3"
        ? mergeFormat(msg.body)
        : INSTANCE === "account1"
          ? mergeFormat2(msg.body)
          : msg.body,
    preview: previewMatch?.[0] ?? msg.body.substring(0, 60),
    receivedAt: new Date().toISOString(),
    dispatchedAt: null,
    status: "waiting",
    neighborhood: neighborhood || "não identificado",
    class: announcementCls,
    targetGroups,
  };

  if (INSTANCE === "account3") {
    await msg.reply(entry.body);
  }

  state.todayQueue.push(entry);
  await persistence.saveQueue();

  const scheduledTime = state.SCHEDULE[entry.index] || "—";
  const classText =
    announcementCls === "GENERAL"
      ? "⚠️ não identificado — apenas grupos gerais"
      : `✅ *${announcementCls}*`;

  await msg.reply(
    `✅ *Mensagem ${state.todayQueue.length}/14 recebida!*\n\n` +
      `📍 Bairro: *${neighborhood || "não identificado"}*\n` +
      `🏷️ Classe: ${classText}\n` +
      `📢 Grupos de destino: *${targetGroups.length}*\n\n` +
      `⏰ Agendado para *${scheduledTime}*`,
  );

  await persistence.log(
    "RECEIVED",
    `Msg ${state.todayQueue.length} | bairro: ${neighborhood || "não identificado"} | classe: ${announcementCls} | grupos: ${targetGroups.length}`,
  );
});

module.exports = { client, startBot };
