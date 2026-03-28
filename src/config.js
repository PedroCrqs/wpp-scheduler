const path = require("path");

const INSTANCE = process.argv[2] || "account1";

const DATA_DIR = path.join(__dirname, "data");

const QUEUES_DIR = path.join(DATA_DIR, "queues");
const SCHEDULES_DIR = path.join(DATA_DIR, "schedules");
const LOGS_DIR = path.join(DATA_DIR, "logs");
const SESSIONS_DIR = path.join(DATA_DIR, "sessions");

[QUEUES_DIR, SCHEDULES_DIR, LOGS_DIR, SESSIONS_DIR].forEach((dir) =>
  fs.mkdirSync(dir, { recursive: true }),
);

const QUEUE_PATH = path.join(QUEUES_DIR, `queue-${INSTANCE}.json`);
const LOG_PATH = path.join(LOGS_DIR, `log-${INSTANCE}.json`);
const SCHEDULE_PATH = path.join(SCHEDULES_DIR, `schedule-${INSTANCE}.json`);

if (!ACCOUNTS[INSTANCE]) {
  console.error(`❌ Instance "${INSTANCE}" not found in ACCOUNTS.`);
  process.exit(1);
}

const GENERAL_GROUPS = ACCOUNTS[INSTANCE].generalGroups;
const SPECIFIC_GROUPS = ACCOUNTS[INSTANCE].specificGroups;

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
  RECREIO_BARRA: [
    // deixe vazio — essa classe é definida pelos grupos,
    // não pelo bairro. Grupos RECREIO_BARRA recebem
    // tanto anúncios de BARRA quanto de RECREIO.
  ],
};

module.exports = {
  QUEUE_PATH,
  LOG_PATH,
  SCHEDULE_PATH,
  SESSIONS_DIR,
  INSTANCE,
  ACCOUNTS,
  GENERAL_GROUPS,
  SPECIFIC_GROUPS,
  NEIGHBORHOOD_CLASSES,
};
