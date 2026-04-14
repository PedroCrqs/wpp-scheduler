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
} = require("./commands");
const { mergeFormat } = require("./format");

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: `scheduler-bot-${INSTANCE}`,
    dataPath: SESSIONS_DIR,
  }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

state.client = client;

client.on("qr", (qr) => {
  console.log("\n══════════════════════════════════════════");
  console.log("  Escaneie o QR Code abaixo com o WhatsApp");
  console.log("══════════════════════════════════════════\n");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  await persistence.log("BOT", "WhatsApp client ready ✓");
  state.myBsuid = ACCOUNTS[INSTANCE].myBsuid;
  console.log("BSUID:", state.myBsuid);

  state.todayQueue = persistence.loadQueue();
  state.dispatchesDone = state.todayQueue.filter(
    (m) => m.status === "sent",
  ).length;

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

  await scheduleDispatches();

  if (!state.resetCronInitialized) {
    initResetScheduler();
  }

  cron.schedule("* * * * *", checkMissedDispatches, {
    timezone: "America/Sao_Paulo",
  });

  const current = new Date()
    .toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "")
    .trim();

  if (current >= "09:00") {
    state.SCHEDULE.forEach((time, index) => {
      if (time < current) {
        const msg = state.todayQueue[index];
        if (msg && msg.status === "waiting") {
          persistence.log(
            "BOT",
            `Slot ${index + 1} (${time}) missed — firing now (bot was offline)`,
          );
          queueDispatch(index);
        }
      }
    });
  }
});

client.on("auth_failure", (msg) => {
  persistence.log("ERROR", `Auth failure: ${msg}`);
});

client.on("disconnected", (reason) => {
  persistence.log("WARN", `Disconnected: ${reason}`);
});

client.on("message_create", async (msg) => {
  const myId = client.info.wid._serialized;

  if (!msg.fromMe || (msg.to !== state.myBsuid && msg.to !== myId)) return;

  const botPrefixes = ["✅", "⚠️", "📊", "🗑️", "📋", "📤"];
  if (botPrefixes.some((p) => msg.body.startsWith(p))) return;

  const msgId = msg.id._serialized;
  if (state.processedMessages.has(msgId)) return;
  state.processedMessages.add(msgId);

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

  if (state.todayQueue.length >= 14) {
    await msg.reply("⚠️ Queue is full (14/14). Send *!clear* to reset.");
    return;
  }

  const neighborhood = extractNeighborhood(msg.body);
  const announcementCls = classifyNeighborhood(neighborhood);
  const targetGroups = resolveGroups(announcementCls);
  const previewMatch = msg.body.match(/\*•[^\n]+\* - _[^\n]+_/);

  const entry = {
    index: state.todayQueue.length,
    body: INSTANCE === "account3" ? mergeFormat(msg.body) : msg.body,
    preview: previewMatch?.[0] ?? msg.body.substring(0, 60),
    receivedAt: new Date().toISOString(),
    dispatchedAt: null,
    status: "waiting",
    neighborhood: neighborhood || "unidentified",
    class: announcementCls,
    targetGroups: targetGroups,
  };

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

module.exports = { client };
