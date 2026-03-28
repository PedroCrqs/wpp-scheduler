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

let myBsuid = null;

console.log(`🤖 Starting instance: ${INSTANCE}`);

const { client } = require("./src/client");
client.initialize();

// ─────────────────────────────────────────────
// AGENDAMENTO DOS DISPAROS
// ─────────────────────────────────────────────

// Guarda as tarefas CRON dos slots para poder destruí-las no reset diário
let slotCronTasks = [];

// ─────────────────────────────────────────────
// FILA DE DISPAROS — garante execução sequencial
// Um disparo só começa quando o anterior terminar completamente
// ─────────────────────────────────────────────

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
