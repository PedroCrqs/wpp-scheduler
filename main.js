/**
 * WhatsApp Scheduler Bot
 * Receives messages sent to self and dispatches them
 * automatically to groups at scheduled times.
 *
 * Install:
 *   npm install whatsapp-web.js qrcode-terminal node-cron
 *
 * Usage:
 *   node main.js account1
 *   node main.js account2
 */

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const cron = require("node-cron");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");

// ─────────────────────────────────────────────
// CONFIGURAÇÃO — edite aqui
// ─────────────────────────────────────────────

// Uso: node main.js account1 | node main.js account2 | etc.
const INSTANCE = process.argv[2] || "account1";

let myBsuid = null;

const ACCOUNTS = {
  account1: {
    myBsuid: "228707713171512@lid",
    generalGroups: [
      "5521970332124-1509473137@g.us",
      "120363154129227809@g.us",
      "5521972290909-1435462863@g.us",
      "5521964194782-1489102107@g.us",
      "5521986216959-1453312836@g.us",
      "120363223801067906@g.us",
      "5521964545934-1504354606@g.us",
      "120363338501614013@g.us",
      "5521988642321-1587302497@g.us",
      "5521988642321-1581686773@g.us",
      "120363144902599168@g.us",
      "5521997541234-1591881446@g.us",
      "120363095302445192@g.us",
      "5521969194514-1529010364@g.us",
      "5521988929899-1462710874@g.us",
      "5521966637232-1566485211@g.us",
      "5521992484544-1400535498@g.us",
      "5521980387687-1495287004@g.us",
      "5521981117284-1534255294@g.us",
      "120363215949771663@g.us",
      "120363043076231689@g.us",
      "5521999014301-1504872112@g.us",
      "120363022807549390@g.us",
    ],
    specificGroups: [
      { id: "5521970445787-1605316109@g.us", class: "BARRA" },
      { id: "120363020895251858@g.us", class: "BARRA" },
      { id: "5521970332124-1504982668@g.us", class: "JACAREPAGUA" },
      { id: "120363182260841786@g.us", class: "JACAREPAGUA" },
      { id: "5521999014301-1582451276@g.us", class: "JACAREPAGUA" },
      { id: "5521964429890-1567293556@g.us", class: "JACAREPAGUA" },
      { id: "120363038446694631@g.us", class: "RECREIO" },
      { id: "5521970445787-1633040235@g.us", class: "RECREIO" },
      { id: "5521999014301-1584277277@g.us", class: "RECREIO_BARRA" },
      { id: "5521964429890-1567293109@g.us", class: "RECREIO_BARRA" },
      { id: "5521964429890-1571490849@g.us", class: "VARGENS" },
      { id: "120363204631755901@g.us", class: "VARGENS" },
      { id: "120363166930472489@g.us", class: "BARRA_OLIMPICA" },
      { id: "5521999014301-1582451276@g.us", class: "BARRA_OLIMPICA" },
      { id: "120363020895251858@g.us", class: "BARRA_OLIMPICA" },
      { id: "5521970445787-1605316109@g.us", class: "BARRA_OLIMPICA" },
      { id: "120363182260841786@g.us", class: "BARRA_OLIMPICA" },
    ],
  },
  account2: {
    myBsuid: "96654279573661@lid",
    generalGroups: [
      "5521970332124-1509473137@g.us",
      "120363154129227809@g.us",
      "5521972290909-1435462863@g.us",
      "5521964194782-1489102107@g.us",
      "5521986216959-1453312836@g.us",
      "120363223801067906@g.us",
      "5521964545934-1504354606@g.us",
      "120363338501614013@g.us",
      "5521988642321-1587302497@g.us",
      "5521988642321-1581686773@g.us",
      "120363144902599168@g.us",
      "5521997541234-1591881446@g.us",
      "120363095302445192@g.us",
      "5521969194514-1529010364@g.us",
      "5521988929899-1462710874@g.us",
      "5521966637232-1566485211@g.us",
      "5521992484544-1400535498@g.us",
      "5521980387687-1495287004@g.us",
      "5521981117284-1534255294@g.us",
      "120363215949771663@g.us",
      "120363043076231689@g.us",
      "5521999014301-1504872112@g.us",
      "5521982447264-1415755126@g.us",
      "5521988642321-1582127514@g.us",
      "120363282025326081@g.us",
      "120363199259987610@g.us",
      "5521979047820-1389222414@g.us",
      "5521970344144-1615922433@g.us",
      "5521987940707-1583522483@g.us",
      "5521964253178-1487804469@g.us",
      "5521980588248-1549549824@g.us",
      "5521987090435-1623413892@g.us",
      "5521999998815-1507116785@g.us",
      "5521983011032-1567556593@g.us",
      "5521964916295-1501348348@g.us",
      "5521970332124-1510604775@g.us",
      "5521964850750-1549494789@g.us",
      "120363303318917329@g.us",
      "5521999275273-1486413262@g.us",
      "5521964253178-1413589529@g.us",
      "5521964312509-1458744834@g.us",
      "5521969337001-1493229961@g.us",
      "5521986216959-1596050915@g.us",
      "120363281756743290@g.us",
      // ─── grupos exclusivos da account2 — adicione abaixo ───
    ],
    specificGroups: [
      { id: "5521970445787-1605316109@g.us", class: "BARRA" },
      { id: "120363020895251858@g.us", class: "BARRA" },
      { id: "5521970332124-1504982668@g.us", class: "JACAREPAGUA" },
      { id: "120363182260841786@g.us", class: "JACAREPAGUA" },
      { id: "5521999014301-1582451276@g.us", class: "JACAREPAGUA" },
      { id: "5521964429890-1567293556@g.us", class: "JACAREPAGUA" },
      { id: "5521987940707-1580215804@g.us", class: "JACAREPAGUA" },
      { id: "120363038446694631@g.us", class: "RECREIO" },
      { id: "5521970445787-1633040235@g.us", class: "RECREIO" },
      { id: "5521999014301-1584277277@g.us", class: "RECREIO_BARRA" },
      { id: "5521964429890-1567293109@g.us", class: "RECREIO_BARRA" },
      { id: "5521999150387-1490619690@g.us", class: "RECREIO_BARRA" },
      { id: "5521964253033-1524608642@g.us", class: "RECREIO_BARRA" },
      { id: "5521964429890-1571490849@g.us", class: "VARGENS" },
      { id: "120363204631755901@g.us", class: "VARGENS" },
      { id: "5521999014301-1583261245@g.us", class: "VARGENS" },
      { id: "120363166930472489@g.us", class: "BARRA_OLIMPICA" },
      { id: "5521999014301-1582451276@g.us", class: "BARRA_OLIMPICA" },
      { id: "120363020895251858@g.us", class: "BARRA_OLIMPICA" },
      { id: "5521970445787-1605316109@g.us", class: "BARRA_OLIMPICA" },
      { id: "120363182260841786@g.us", class: "BARRA_OLIMPICA" },
      // ─── grupos específicos exclusivos da account2 — adicione abaixo ───
    ],
  },
  // account3: { myBsuid: "", generalGroups: [], specificGroups: [] },
};

if (!ACCOUNTS[INSTANCE]) {
  console.error(`❌ Instance "${INSTANCE}" not found in ACCOUNTS.`);
  process.exit(1);
}

console.log(`🤖 Starting instance: ${INSTANCE}`);

// ─────────────────────────────────────────────
// GRUPOS POR INSTÂNCIA
// ─────────────────────────────────────────────
const GENERAL_GROUPS = ACCOUNTS[INSTANCE].generalGroups;
const SPECIFIC_GROUPS = ACCOUNTS[INSTANCE].specificGroups;

// ─────────────────────────────────────────────
// PALAVRAS-CHAVE por classe de bairro
// Adicione variações de nome conforme aparecem nos anúncios
// ─────────────────────────────────────────────
const NEIGHBORHOOD_CLASSES = {
  JACAREPAGUA: [
    "jacarepaguá",
    "jacarepagua",
    "pechincha",
    "freguesia",
    "taquara",
    "tanque",
    "praça seca",
    "praca seca",
    "gardênia azul",
    "gardenia azul",
    "curicica",
    "anil",
  ],
  BARRA: ["barra da tijuca", "barra"],
  RECREIO: ["recreio dos bandeirantes", "recreio"],
  VARGENS: ["vargem grande", "vargem pequena", "vargens", "vargem"],
  BARRA_OLIMPICA: ["barra olímpica", "barra olimpica"],
  BARRA_E_OLIMPICA: [],
  RECREIO_BARRA: [
    // deixe vazio — essa classe é definida pelos grupos,
    // não pelo bairro. Grupos RECREIO_BARRA recebem
    // tanto anúncios de BARRA quanto de RECREIO.
  ],
};

// ─────────────────────────────────────────────
// FUNÇÕES DE BAIRRO
// ─────────────────────────────────────────────

/**
 * Extrai o bairro do anúncio.
 * Busca pelo padrão _Bairro_ (itálico WhatsApp) na mensagem.
 */
function extractNeighborhood(text) {
  const match = text.match(/_([^_]+)_/);
  return match ? match[1].trim().toLowerCase() : null;
}

/**
 * Classifica o bairro extraído em uma das classes configuradas.
 * Retorna "GENERAL" se não encontrar correspondência.
 */
function classifyNeighborhood(neighborhood) {
  if (!neighborhood) return "GENERAL";
  const normalized = neighborhood
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const [cls, keywords] of Object.entries(NEIGHBORHOOD_CLASSES)) {
    if (cls === "RECREIO_BARRA") continue; // classe definida pelos grupos
    for (const keyword of keywords) {
      const keyNorm = keyword
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (normalized.includes(keyNorm) || keyNorm.includes(normalized)) {
        return cls;
      }
    }
  }
  return "GENERAL";
}

/**
 * Monta a lista final de grupos para um anúncio,
 * combinando grupos gerais + específicos elegíveis.
 * Usa Set para evitar duplicatas.
 */
function resolveGroups(announcementClass) {
  const eligible = SPECIFIC_GROUPS.filter((g) => {
    if (announcementClass === "GENERAL") return false; // sem classe → só grupos gerais
    if (g.class === announcementClass) return true; // classe exata → inclui
    if (
      g.class === "RECREIO_BARRA" &&
      (announcementClass === "BARRA" || announcementClass === "RECREIO")
    )
      return true;
    return false;
  }).map((g) => g.id);

  // Deduplica usando Set
  return [...new Set([...GENERAL_GROUPS, ...eligible])];
}

// ─────────────────────────────────────────────
// ANTI-BAN: horários com jitter aleatório
// Regenerados apenas no reset diário (19h) ou !clear
// Reiniciar o bot NÃO regenera os horários — eles são persistidos em disco
// ─────────────────────────────────────────────
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
    const jitter = Math.floor(Math.random() * 30); // 0–29 min
    const newMinute = minute + jitter;
    return `${String(hour).padStart(2, "0")}:${String(newMinute).padStart(2, "0")}`;
  });
}

// ─────────────────────────────────────────────
// ARQUIVOS DE ESTADO
// ─────────────────────────────────────────────
const QUEUE_PATH = path.join(__dirname, `queue-${INSTANCE}.json`);
const LOG_PATH = path.join(__dirname, `log-${INSTANCE}.json`);
const SCHEDULE_PATH = path.join(__dirname, `schedule-${INSTANCE}.json`);

// ─────────────────────────────────────────────
// ESTADO INTERNO
// ─────────────────────────────────────────────

let todayQueue = [];
let dispatchesDone = 0;
let SCHEDULE = [];

// Controle de disparo sequencial — garante que um disparo só começa quando o anterior terminar
let dispatchRunning = false;
const pendingDispatches = [];

// Set para evitar processar a mesma mensagem duas vezes
const processedMessages = new Set();

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ANTI-BAN: embaralha a ordem de envio dos grupos
function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

// ANTI-BAN: micro variação invisível no texto para evitar detecção de mensagem duplicada pela META
const INVISIBLE_CHARS = ["\u200B", "\u200C", "\u200D", "\uFEFF"];
function microVary(text) {
  const char =
    INVISIBLE_CHARS[Math.floor(Math.random() * INVISIBLE_CHARS.length)];
  const pos = Math.floor(Math.random() * (text.length - 1)) + 1;
  return text.slice(0, pos) + char + text.slice(pos);
}

// ─────────────────────────────────────────────
// LOG — assíncrono para não bloquear o event loop
// ─────────────────────────────────────────────
async function log(type, detail) {
  const entry = { ts: new Date().toISOString(), type, detail };
  console.log(`[${entry.ts}] [${type}]`, detail);

  try {
    let logs = [];
    try {
      const raw = await fsPromises.readFile(LOG_PATH, "utf8");
      logs = JSON.parse(raw);
    } catch {}
    logs.unshift(entry);
    if (logs.length > 500) logs = logs.slice(0, 500);
    await fsPromises.writeFile(LOG_PATH, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error("[LOG ERROR]", err.message);
  }
}

// ─────────────────────────────────────────────
// PERSISTÊNCIA DA FILA — assíncrona
// ─────────────────────────────────────────────
async function saveQueue() {
  await fsPromises.writeFile(QUEUE_PATH, JSON.stringify(todayQueue, null, 2));
}

function loadQueue() {
  try {
    const data = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8"));
    if (data.length > 0) {
      // Compara datas no fuso de Brasília para evitar descarte incorreto
      // quando receivedAt é madrugada UTC mas ainda é "hoje" em BRT
      const toSPDate = (d) =>
        new Date(d).toLocaleDateString("en-CA", {
          timeZone: "America/Sao_Paulo",
        });
      if (toSPDate(data[0].receivedAt) === toSPDate(new Date())) {
        return data;
      }
    }
  } catch {}
  return [];
}

// ─────────────────────────────────────────────
// PERSISTÊNCIA DO SCHEDULE — sobrevive a reinicializações
// ─────────────────────────────────────────────
function saveSchedule() {
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(SCHEDULE, null, 2));
}

function loadSchedule() {
  try {
    const data = JSON.parse(fs.readFileSync(SCHEDULE_PATH, "utf8"));
    if (Array.isArray(data) && data.length === 10) return data;
  } catch {}
  return null;
}

// ─────────────────────────────────────────────
// RESET DIÁRIO — só ocorre via cron das 19h ou !clear
// ─────────────────────────────────────────────
async function dailyReset() {
  todayQueue = [];
  dispatchesDone = 0;
  processedMessages.clear();
  SCHEDULE = generateSchedule(); // ANTI-BAN: regenera horários só no reset real
  saveSchedule();
  await saveQueue();
  await log(
    "RESET",
    `Queue and counters cleared | New schedule: ${SCHEDULE.join(", ")}`,
  );
  // Reagenda os CRONs com os novos horários — essencial para funcionar sem restart
  scheduleDispatches();
}

// ─────────────────────────────────────────────
// CLIENTE WHATSAPP
// ─────────────────────────────────────────────

const client = new Client({
  authStrategy: new LocalAuth({ clientId: `scheduler-bot-${INSTANCE}` }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("\n══════════════════════════════════════════");
  console.log("  Escaneie o QR Code abaixo com o WhatsApp");
  console.log("══════════════════════════════════════════\n");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  log("BOT", "WhatsApp client ready ✓");
  myBsuid = ACCOUNTS[INSTANCE].myBsuid;
  console.log("BSUID:", myBsuid);

  // Carrega a fila persistida — sobrevive a reinicializações
  todayQueue = loadQueue();
  dispatchesDone = todayQueue.filter((m) => m.status === "sent").length;

  // Carrega o schedule persistido — se não existir, gera um novo
  const savedSchedule = loadSchedule();
  if (savedSchedule) {
    SCHEDULE = savedSchedule;
    log("BOT", `Schedule loaded from disk: ${SCHEDULE.join(", ")}`);
  } else {
    SCHEDULE = generateSchedule();
    saveSchedule();
    log("BOT", `Schedule generated: ${SCHEDULE.join(", ")}`);
  }

  log(
    "BOT",
    `Queue: ${todayQueue.length} message(s) | ${dispatchesDone} already dispatched`,
  );
  scheduleDispatches();

  // Dispara imediatamente qualquer slot cujo horário já passou e ainda está waiting
  // (protege contra restart depois do horário agendado)
  const nowSP = new Date()
    .toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "")
    .trim(); // "HH:MM"

  SCHEDULE.forEach((time, index) => {
    if (time < nowSP) {
      const msg = todayQueue[index];
      if (msg && msg.status === "waiting") {
        log(
          "BOT",
          `Slot ${index + 1} (${time}) missed — firing now (bot was offline)`,
        );
        queueDispatch(index);
      }
    }
  });
});

client.on("auth_failure", (msg) => {
  log("ERROR", `Auth failure: ${msg}`);
});

client.on("disconnected", (reason) => {
  log("WARN", `Disconnected: ${reason}`);
});

// ─────────────────────────────────────────────
// RECEPÇÃO DAS MENSAGENS (enviadas para si mesmo)
// ─────────────────────────────────────────────

client.on("message_create", async (msg) => {
  const myId = client.info.wid._serialized;

  // Só processa mensagens enviadas pelo próprio número para si mesmo
  if (!msg.fromMe || (msg.to !== myBsuid && msg.to !== myId)) return;

  // Ignora respostas automáticas do próprio bot (evita loop)
  const botPrefixes = ["✅", "⚠️", "📊", "🗑️", "📋", "📤"];
  if (botPrefixes.some((p) => msg.body.startsWith(p))) return;

  // Ignora mensagem se já foi processada
  const msgId = msg.id._serialized;
  if (processedMessages.has(msgId)) return;
  processedMessages.add(msgId);

  const body = msg.body.trim().toLowerCase();

  // Comando: "!status"
  if (body === "!status") {
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

  // Comando: "!clear"
  if (body === "!clear") {
    todayQueue = [];
    dispatchesDone = 0;
    processedMessages.clear();
    SCHEDULE = generateSchedule();
    saveSchedule();
    await saveQueue();
    await msg.reply("🗑️ Queue cleared successfully.");
    await log("COMMAND", "Queue manually cleared");
    return;
  }

  // Comando: "!groups"
  if (body === "!groups") {
    const chats = await client.getChats();
    const groups = chats.filter((c) => c.isGroup);
    const list = groups
      .map((g) => `• ${g.name}\n  ID: \`${g.id._serialized}\``)
      .join("\n\n");
    await msg.reply(`📋 *Available groups:*\n\n${list}`);
    return;
  }

  // Comando: "!fire" ou "!fire <índice>"
  // !fire    → dispara o próximo slot com status "waiting"
  // !fire 3  → dispara o slot de índice 3 (1-based)
  if (body.startsWith("!fire")) {
    const parts = body.split(" ");
    let targetIndex;

    if (parts.length === 1) {
      // Próximo slot pendente
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

  // Mensagem normal → adiciona à fila
  if (todayQueue.length >= 10) {
    await msg.reply("⚠️ Queue is full (10/10). Send *!clear* to reset.");
    return;
  }

  const neighborhood = extractNeighborhood(msg.body);
  const announcementCls = classifyNeighborhood(neighborhood);
  const targetGroups = resolveGroups(announcementCls);
  const previewMatch = msg.body.match(/\*•[^\n]+\* - _[^\n]+_/);

  const entry = {
    index: todayQueue.length,
    body: msg.body,
    preview: previewMatch?.[0] ?? msg.body.substring(0, 60),
    receivedAt: new Date().toISOString(),
    dispatchedAt: null,
    status: "waiting",
    neighborhood: neighborhood || "unidentified",
    class: announcementCls,
    targetGroups: targetGroups,
  };

  todayQueue.push(entry);
  await saveQueue();

  const scheduledTime = SCHEDULE[entry.index] || "—";
  const classText =
    announcementCls === "GENERAL"
      ? "⚠️ unidentified — general groups only"
      : `✅ *${announcementCls}*`;

  await msg.reply(
    `✅ *Message ${todayQueue.length}/10 received!*\n\n` +
      `📍 Neighborhood: *${neighborhood || "unidentified"}*\n` +
      `🏷️ Class: ${classText}\n` +
      `📢 Target groups: *${targetGroups.length}*\n\n` +
      `⏰ Scheduled for *${scheduledTime}*`,
  );
  await log(
    "RECEIVED",
    `Msg ${todayQueue.length} | neighborhood: ${neighborhood} | class: ${announcementCls} | groups: ${targetGroups.length}`,
  );
});

// ─────────────────────────────────────────────
// AGENDAMENTO DOS DISPAROS
// ─────────────────────────────────────────────

// Guarda as tarefas CRON dos slots para poder destruí-las no reset diário
let slotCronTasks = [];

function nextScheduledTime() {
  const hhmm = new Date()
    .toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "")
    .trim();
  const next = SCHEDULE.find((h) => h > hhmm);
  return next || "None today (all passed)";
}

function scheduleDispatches() {
  // Destroi CRONs dos slots anteriores para evitar acúmulo entre dias
  slotCronTasks.forEach((task) => task.destroy());
  slotCronTasks = [];

  SCHEDULE.forEach((time, index) => {
    const [hour, minute] = time.split(":");
    const expression = `${minute} ${hour} * * *`;

    const task = cron.schedule(
      expression,
      async () => {
        await log("CRON", `Trigger for slot ${index + 1} (${time})`);
        queueDispatch(index);
      },
      { timezone: "America/Sao_Paulo" },
    );

    slotCronTasks.push(task);
    log("CRON", `Scheduled slot ${index + 1} at ${time}`);
  });

  log("CRON", `${SCHEDULE.length} slots scheduled ✓`);
}

// ─────────────────────────────────────────────
// FILA DE DISPAROS — garante execução sequencial
// Um disparo só começa quando o anterior terminar completamente
// ─────────────────────────────────────────────
function queueDispatch(index) {
  pendingDispatches.push(index);
  processDispatchQueue();
}

async function processDispatchQueue() {
  // Se já há um disparo em andamento, aguarda — será retomado ao final do atual
  if (dispatchRunning) return;
  if (pendingDispatches.length === 0) return;

  dispatchRunning = true;
  const index = pendingDispatches.shift();

  try {
    await executeDispatch(index);
  } catch (err) {
    await log("ERROR", `Unhandled error in slot ${index + 1}: ${err.message}`);
  } finally {
    dispatchRunning = false;
    // Processa o próximo da fila, se houver
    if (pendingDispatches.length > 0) {
      processDispatchQueue();
    }
  }
}

async function executeDispatch(index) {
  await log(
    "DISPATCH",
    `Starting slot ${index + 1} (${SCHEDULE[index] || "manual"})`,
  );

  if (index >= todayQueue.length) {
    await log("WARN", `Slot ${index + 1}: no message in queue for this slot`);
    return;
  }

  const message = todayQueue[index];

  // Proteção dupla contra disparo duplicado
  if (message.status === "sent") {
    await log("WARN", `Slot ${index + 1}: already sent, skipping`);
    return;
  }
  if (message.status === "sending") {
    await log("WARN", `Slot ${index + 1}: already in progress, skipping`);
    return;
  }

  // Marca como "sending" imediatamente para bloquear chamadas simultâneas
  todayQueue[index].status = "sending";
  await saveQueue();

  let successes = 0;
  let failures = 0;

  // ANTI-BAN: embaralha a ordem de envio dos grupos
  const targetGroups = shuffle(message.targetGroups || GENERAL_GROUPS);

  await log(
    "DISPATCH",
    `Slot ${index + 1} | neighborhood: ${message.neighborhood || "—"} | class: ${message.class || "GENERAL"} | ${targetGroups.length} groups`,
  );

  for (let i = 0; i < targetGroups.length; i++) {
    const groupId = targetGroups[i];
    try {
      const chat = await client.getChatById(groupId);
      // ANTI-BAN: micro variação no texto para evitar detecção de duplicata pela META
      await chat.sendMessage(microVary(message.body));
      await log("SENT", `Slot ${index + 1} → ${chat.name || groupId}`);
      successes++;

      // ANTI-BAN: pausa longa a cada 5 envios
      if ((i + 1) % 5 === 0) {
        await sleep(15000 + Math.random() * 20000); // 15–35s
      } else {
        // ANTI-BAN: delay variável entre envios individuais
        await sleep(4000 + Math.random() * 8000); // 4–12s
      }
    } catch (err) {
      await log("ERROR", `Slot ${index + 1} → ${groupId}: ${err.message}`);
      failures++;
    }
  }

  // Atualiza estado e incrementa contador UMA única vez, fora do loop
  todayQueue[index].status =
    failures === targetGroups.length ? "error" : "sent";
  todayQueue[index].dispatchedAt = new Date().toISOString();
  todayQueue[index].result = { successes, failures };
  dispatchesDone++;
  await saveQueue();

  await log(
    "DISPATCH",
    `Slot ${index + 1} done — ${successes} ok, ${failures} failed`,
  );

  // Notifica via mensagem para si mesmo
  try {
    const myId = client.info.wid._serialized;
    await client.sendMessage(
      myId,
      `📤 *Dispatch ${index + 1}/10 done* (${SCHEDULE[index] || "manual"})\n\n` +
        `✅ Sent to ${successes} group(s)\n` +
        (failures > 0 ? `❌ Failed in ${failures} group(s)\n` : "") +
        `📝 "${message.preview}"`,
    );
  } catch {}
}

// ─────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────

console.log("");
console.log("██████╗  ██████╗ ████████╗");
console.log("██╔══██╗██╔═══██╗╚══██╔══╝");
console.log("██████╔╝██║   ██║   ██║   ");
console.log("██╔══██╗██║   ██║   ██║   ");
console.log("██████╔╝╚██████╔╝   ██║   ");
console.log("╚═════╝  ╚═════╝    ╚═╝   ");
console.log("  WhatsApp Scheduler Bot  ");
console.log("");

// Reset diário às 19:00 BRT — registrado uma única vez na inicialização
// O próprio dailyReset chama scheduleDispatches() para reagendar os slots do novo dia
cron.schedule("0 19 * * *", dailyReset, { timezone: "America/Sao_Paulo" });

client.initialize();
