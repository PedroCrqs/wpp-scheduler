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
