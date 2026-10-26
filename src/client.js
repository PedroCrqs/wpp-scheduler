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
    await persistence.log("BOT", "Starting WhatsApp client...");
    await client.initialize();
  } catch (err) {
    await persistence.log(
      "ERROR",
      `Initialization failed: ${err.message}. Retrying in 30s...`,
    );
    // NOTE: setTimeout receives the function reference, not its return value
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
  await persistence.log("BOT", "WhatsApp client ready ✓");
  state.myBsuid = ACCOUNTS[INSTANCE].myBsuid;
  console.log("BSUID:", state.myBsuid);

  // Adicione estes ouvintes ANTES do client.initialize() para debugar a transição:
  client.on("authenticated", async () => {
    await persistence.log("BOT", "WhatsApp authenticated, loading session...");
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

  // Carrega ou gera schedule
  const savedSchedule = persistence.loadSchedule();
  if (savedSchedule) {
    state.SCHEDULE = savedSchedule.slots;
    state.scheduleDate = savedSchedule.date;
    await persistence.log(
      "BOT",
      `Schedule loaded from disk: ${state.SCHEDULE.join(", ")}`,
    );
  } else {
    state.SCHEDULE = generateSchedule();
    state.scheduleDate = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });
    persistence.saveSchedule();
    await persistence.log(
      "BOT",
      `Schedule generated: ${state.SCHEDULE.join(", ")}`,
    );
  }

  await persistence.log(
    "BOT",
    `Queue: ${state.todayQueue.length} message(s) | ${state.dispatchesDone} already dispatched`,
  );

  // Recover slots stuck in "sending" before checking queue emptiness
  await persistence.recoverSendingSlots();

  // Auto-feed on boot: if queue is still empty after recovery, fetch from DB
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
  persistence.log("ERROR", `Auth failure: ${msg}`);
  setTimeout(startBot, 30000);
});

client.on("disconnected", (reason) => {
  persistence.log("WARN", `Disconnected: ${reason}`);
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
  if (msg.body === "!clear") {
    await handleClear(msg);
    return;
  }
  if (msg.body === "!groups") {
    await handleGroups(client, msg);
    return;
  }
  if (msg.body.startsWith("!fire")) {
    await handleFire(msg);
    return;
  }
  if (msg.body.startsWith("!stopreset")) {
    await handleStopMidnightReset(msg);
    return;
  }
  if (msg.body.startsWith("!reset --reschedule")) {
    await handleReset(msg, true);
    return;
  }
  if (msg.body.startsWith("!reset")) {
    await handleReset(msg, false);
    return;
  }
  if (msg.body.startsWith("!clearReservations")) {
    await handleResetReservedToday(msg);
    return;
  }

  // ── Limite de fila ────────────────────────────────────────────────────────
  if (state.todayQueue.length >= 14) {
    await msg.reply("⚠️ Queue is full (14/14). Send *!clear* to reset.");
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
    neighborhood: neighborhood || "unidentified",
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
      ? "⚠️ unidentified — general groups only"
      : `✅ *${announcementCls}*`;

  await msg.reply(
    `✅ *Message ${state.todayQueue.length}/14 received!*\n\n` +
      `📍 Neighborhood: *${neighborhood || "unidentified"}*\n` +
      `🏷️ Class: ${classText}\n` +
      `📢 Target groups: *${targetGroups.length}*\n\n` +
      `⏰ Scheduled for *${scheduledTime}*`,
  );

  await persistence.log(
    "RECEIVED",
    `Msg ${state.todayQueue.length} | neighborhood: ${neighborhood} | class: ${announcementCls} | groups: ${targetGroups.length}`,
  );
});

module.exports = { client, startBot };
