/**
 * WhatsApp Scheduler Bot
 * Receives messages sent to self and dispatches them
 * automatically to groups at scheduled times.
 *
 * Usage:
 *   node index.js account1
 *   node index.js account2
 */

const { INSTANCE } = require("./src/config");

console.log("");
console.log("██████╗  ██████╗ ████████╗");
console.log("██╔══██╗██╔═══██╗╚══██╔══╝");
console.log("██████╔╝██║   ██║   ██║   ");
console.log("██╔══██╗██║   ██║   ██║   ");
console.log("██████╔╝╚██████╔╝   ██║   ");
console.log("╚═════╝  ╚═════╝    ╚═╝   ");
console.log("  WhatsApp Scheduler Bot  ");
console.log("");
console.log(`🤖 Starting instance: ${INSTANCE}`);

const { client } = require("./src/client");
client.initialize();

