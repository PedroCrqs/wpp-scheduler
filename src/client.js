const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const cron = require("node-cron");

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

  todayQueue = loadQueue();
  dispatchesDone = todayQueue.filter((m) => m.status === "sent").length;

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

client.on("message_create", async (msg) => {
  const myId = client.info.wid._serialized;

  if (!msg.fromMe || (msg.to !== myBsuid && msg.to !== myId)) return;

  const botPrefixes = ["✅", "⚠️", "📊", "🗑️", "📋", "📤"];
  if (botPrefixes.some((p) => msg.body.startsWith(p))) return;

  const msgId = msg.id._serialized;
  if (processedMessages.has(msgId)) return;
  processedMessages.add(msgId);

  const body = msg.body.trim().toLowerCase();

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
