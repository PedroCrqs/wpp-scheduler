const path = require("path");
const fs = require("fs");

const INSTANCE = process.argv[2] || "account1";

const DATA_DIR = path.join(process.cwd(), "data");

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
    ],
  },
  account3: {
    myBsuid: "204388903727229@lid",
    generalGroups: [],
    specificGroups: [],
  },
};

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
