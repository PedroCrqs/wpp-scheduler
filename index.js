const { INSTANCE } = require("./src/config");
const { client, startBot } = require("./src/client");

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

startBot();
