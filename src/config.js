const path = require("path");
const fs = require("fs");

const INSTANCE = process.argv[2] || "account1";

const DATA_DIR = path.join(process.cwd(), "data");

const INSTANCE_DIR = path.join(DATA_DIR, INSTANCE);

const QUEUES_DIR = path.join(INSTANCE_DIR, "queues");
const SCHEDULES_DIR = path.join(INSTANCE_DIR, "schedules");
const LOGS_DIR = path.join(INSTANCE_DIR, "logs");
const SESSIONS_DIR = path.join(INSTANCE_DIR, "sessions");

[QUEUES_DIR, SCHEDULES_DIR, LOGS_DIR, SESSIONS_DIR].forEach((dir) =>
  fs.mkdirSync(dir, { recursive: true }),
);

const QUEUE_PATH = path.join(QUEUES_DIR, `queue-${INSTANCE}.json`);
const LOG_PATH = path.join(LOGS_DIR, `log-${INSTANCE}.json`);
const SCHEDULE_PATH = path.join(SCHEDULES_DIR, `schedule-${INSTANCE}.json`);

// Carrega arquivo .env se existir (Node.js 20+)
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // Arquivo .env opcional
}

function loadAccountsConfig() {
  // 1. Variável de ambiente com JSON direto (ex: Docker / CI / PM2)
  if (process.env.ACCOUNTS_JSON) {
    try {
      return JSON.parse(process.env.ACCOUNTS_JSON);
    } catch (err) {
      console.error(`❌ Erro ao processar ACCOUNTS_JSON: ${err.message}`);
      process.exit(1);
    }
  }

  // 2. Caminho explícito definido em ACCOUNTS_CONFIG_PATH ou padrão na raiz
  const configPath = process.env.ACCOUNTS_CONFIG_PATH
    ? path.resolve(process.env.ACCOUNTS_CONFIG_PATH)
    : path.join(process.cwd(), "accounts.json");

  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
      console.error(`❌ Erro ao ler "${configPath}": ${err.message}`);
      process.exit(1);
    }
  }

  // 3. Fallback alternativo em data/accounts.json
  const dataConfigPath = path.join(DATA_DIR, "accounts.json");
  if (fs.existsSync(dataConfigPath)) {
    try {
      return JSON.parse(fs.readFileSync(dataConfigPath, "utf8"));
    } catch (err) {
      console.error(`❌ Erro ao ler "${dataConfigPath}": ${err.message}`);
      process.exit(1);
    }
  }

  console.error(
    "❌ Configuração de contas não encontrada!\n" +
      "Defina a variável ACCOUNTS_JSON ou crie o arquivo accounts.json na raiz do projeto.\n" +
      "Veja 'accounts.example.json' como modelo.",
  );
  process.exit(1);
}

const ACCOUNTS = loadAccountsConfig();

if (!ACCOUNTS[INSTANCE]) {
  console.error(`❌ Instância "${INSTANCE}" não encontrada em ACCOUNTS.`);
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
  ZONA_SUL: [
    // 18 bairros oficiais da Zona Sul (Prefeitura do Rio / IPP)
    "botafogo",
    "catete",
    "copacabana",
    "cosme velho",
    "flamengo",
    "gávea",
    "gavea",
    "glória",
    "gloria",
    "humaitá",
    "humaita",
    "ipanema",
    "jardim botânico",
    "jardim botanico",
    "lagoa",
    "laranjeiras",
    "leblon",
    "leme",
    "rocinha",
    "são conrado",
    "sao conrado",
    "urca",
    "vidigal",
    // Sub-regiões e referências frequentes do mercado imobiliário
    "arpoador",
    "horto",
    "fonte da saudade",
    "zona sul",
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
