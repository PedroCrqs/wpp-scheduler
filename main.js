/**
 * WhatsApp Scheduler Bot
 * Recebe mensagens do seu número pessoal e as dispara
 * automaticamente para grupos nos horários programados.
 *
 * Instalação:
 *   npm install whatsapp-web.js qrcode-terminal node-cron
 */

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────
// CONFIGURAÇÃO — edite aqui
// ─────────────────────────────────────────────

// Uso: node main.js conta1 | node main.js conta2 | etc.
const INSTANCIA = process.argv[2] || "conta1";

const CONTAS = {
  conta1: {
    gruposGerais: [
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
    gruposEspecificos: [
      { id: "5521970445787-1605316109@g.us", classe: "BARRA" },
      { id: "120363020895251858@g.us", classe: "BARRA" },
      { id: "5521970332124-1504982668@g.us", classe: "JACAREPAGUA" },
      { id: "120363182260841786@g.us", classe: "JACAREPAGUA" },
      { id: "5521999014301-1582451276@g.us", classe: "JACAREPAGUA" },
      { id: "5521964429890-1567293556@g.us", classe: "JACAREPAGUA" },
      { id: "120363038446694631@g.us", classe: "RECREIO" },
      { id: "5521970445787-1633040235@g.us", classe: "RECREIO" },
      { id: "5521999014301-1584277277@g.us", classe: "RECREIO_BARRA" },
      { id: "5521964429890-1567293109@g.us", classe: "RECREIO_BARRA" },
      { id: "5521964429890-1571490849@g.us", classe: "VARGENS" },
      { id: "120363204631755901@g.us", classe: "VARGENS" },
      { id: "120363166930472489@g.us", classe: "BARRA_OLIMPICA" },
      { id: "5521999014301-1582451276@g.us", classe: "BARRA_OLIMPICA" },
      { id: "120363020895251858@g.us", classe: "BARRA_OLIMPICA" },
      { id: "5521970445787-1605316109@g.us", classe: "BARRA_OLIMPICA" },
      { id: "120363182260841786@g.us", classe: "BARRA_OLIMPICA" },
    ],
  },
  conta2: {
    gruposGerais: [
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
      // ─── grupos exclusivos da conta2 — adicione abaixo ───
    ],
    gruposEspecificos: [
      { id: "5521970445787-1605316109@g.us", classe: "BARRA" },
      { id: "120363020895251858@g.us", classe: "BARRA" },
      { id: "5521970332124-1504982668@g.us", classe: "JACAREPAGUA" },
      { id: "120363182260841786@g.us", classe: "JACAREPAGUA" },
      { id: "5521999014301-1582451276@g.us", classe: "JACAREPAGUA" },
      { id: "5521964429890-1567293556@g.us", classe: "JACAREPAGUA" },
      { id: "5521987940707-1580215804@g.us", classe: "JACAREPAGUA" },
      { id: "120363038446694631@g.us", classe: "RECREIO" },
      { id: "5521970445787-1633040235@g.us", classe: "RECREIO" },
      { id: "120363038446694631@g.us", classe: "RECREIO" },
      { id: "5521999014301-1584277277@g.us", classe: "RECREIO_BARRA" },
      { id: "5521964429890-1567293109@g.us", classe: "RECREIO_BARRA" },
      { id: "5521999150387-1490619690@g.us", classe: "RECREIO_BARRA" },
      { id: "5521964253033-1524608642@g.us", classe: "RECREIO_BARRA" },
      { id: "5521964429890-1571490849@g.us", classe: "VARGENS" },
      { id: "120363204631755901@g.us", classe: "VARGENS" },
      { id: "5521999014301-1583261245@g.us", classe: "VARGENS" },
      { id: "120363166930472489@g.us", classe: "BARRA_OLIMPICA" },
      { id: "5521999014301-1582451276@g.us", classe: "BARRA_OLIMPICA" },
      { id: "120363020895251858@g.us", classe: "BARRA_OLIMPICA" },
      { id: "5521970445787-1605316109@g.us", classe: "BARRA_OLIMPICA" },
      { id: "120363182260841786@g.us", classe: "BARRA_OLIMPICA" },
      // ─── grupos específicos exclusivos da conta2 — adicione abaixo ───
    ],
  },
  // conta3: { gruposGerais: [], gruposEspecificos: [] },
};

if (!CONTAS[INSTANCIA]) {
  console.error(`❌ Instância "${INSTANCIA}" não encontrada em CONTAS.`);
  process.exit(1);
}

console.log(`🤖 Iniciando instância: ${INSTANCIA}`);

// ─────────────────────────────────────────────
// GRUPOS POR INSTÂNCIA
// ─────────────────────────────────────────────
const GRUPOS_GERAIS = CONTAS[INSTANCIA].gruposGerais;
const GRUPOS_ESPECIFICOS = CONTAS[INSTANCIA].gruposEspecificos;

// ─────────────────────────────────────────────
// PALAVRAS-CHAVE por classe de bairro
// Adicione variações de nome conforme aparecem nos anúncios
// ─────────────────────────────────────────────
const BAIRROS_CLASSE = {
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
function extrairBairro(texto) {
  // Captura o conteúdo entre _ _ na primeira ocorrência
  const match = texto.match(/_([^_]+)_/);
  return match ? match[1].trim().toLowerCase() : null;
}

/**
 * Classifica o bairro extraído em uma das classes configuradas.
 * Retorna "GERAL" se não encontrar correspondência.
 */
function classificarBairro(bairro) {
  if (!bairro) return "GERAL";
  const bairroNorm = bairro
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const [classe, palavras] of Object.entries(BAIRROS_CLASSE)) {
    if (classe === "RECREIO_BARRA") continue; // classe definida pelos grupos
    for (const palavra of palavras) {
      const palavraNorm = palavra
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (
        bairroNorm.includes(palavraNorm) ||
        palavraNorm.includes(bairroNorm)
      ) {
        return classe;
      }
    }
  }
  return "GERAL";
}

/**
 * Monta a lista final de grupos para um anúncio,
 * combinando grupos gerais + específicos elegíveis.
 */
function resolverGrupos(classeAnuncio) {
  const especificosElegiveis = GRUPOS_ESPECIFICOS.filter((g) => {
    if (classeAnuncio === "GERAL") return false; // sem classe → só grupos gerais
    if (g.classe === classeAnuncio) return true; // classe exata → inclui
    if (
      g.classe === "RECREIO_BARRA" &&
      (classeAnuncio === "BARRA" || classeAnuncio === "RECREIO")
    )
      return true;
    return false; // outra classe → exclui
  }).map((g) => g.id);

  return [...GRUPOS_GERAIS, ...especificosElegiveis];
}

// ─────────────────────────────────────────────
// ANTI-BAN: horários com jitter aleatório
// Regenerados a cada dia para evitar padrão fixo
// ─────────────────────────────────────────────
function gerarHorarios() {
  const base = [
    { hora: 9, minuto: 0 },
    { hora: 10, minuto: 0 },
    { hora: 11, minuto: 0 },
    { hora: 12, minuto: 0 },
    { hora: 13, minuto: 0 },
    { hora: 14, minuto: 0 },
    { hora: 15, minuto: 0 },
    { hora: 16, minuto: 0 },
    { hora: 17, minuto: 0 },
    { hora: 18, minuto: 0 },
  ];
  return base.map(({ hora, minuto }) => {
    const jitter = Math.floor(Math.random() * 30);
    const novoMinuto = minuto + jitter;
    return `${String(hora).padStart(2, "0")}:${String(novoMinuto).padStart(2, "0")}`;
  });
}

let HORARIOS = gerarHorarios();

// Arquivo onde as mensagens do dia ficam salvas
const FILA_PATH = path.join(__dirname, `fila-${INSTANCIA}.json`);
// Arquivo de log
const LOG_PATH = path.join(__dirname, `log-${INSTANCIA}.json`);

// ─────────────────────────────────────────────
// ESTADO INTERNO
// ─────────────────────────────────────────────

let filaHoje = [];
let disparosFeitos = 0;

// FIX 1: Set para evitar processar a mesma mensagem duas vezes
const mensagensProcessadas = new Set();

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ANTI-BAN: embaralha a ordem de envio dos grupos
function embaralhar(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function log(tipo, detalhe) {
  const entrada = {
    ts: new Date().toISOString(),
    tipo,
    detalhe,
  };
  console.log(`[${entrada.ts}] [${tipo}]`, detalhe);

  let logs = [];
  try {
    logs = JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
  } catch {}
  logs.unshift(entrada);
  if (logs.length > 500) logs = logs.slice(0, 500);
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
}

function salvarFila() {
  fs.writeFileSync(FILA_PATH, JSON.stringify(filaHoje, null, 2));
}

function carregarFila() {
  try {
    const data = JSON.parse(fs.readFileSync(FILA_PATH, "utf8"));
    if (data.length > 0) {
      const primeiroTs = new Date(data[0].recebidoEm);
      const hoje = new Date();
      if (
        primeiroTs.getDate() === hoje.getDate() &&
        primeiroTs.getMonth() === hoje.getMonth() &&
        primeiroTs.getFullYear() === hoje.getFullYear()
      ) {
        return data;
      }
    }
  } catch {}
  return [];
}

function resetarDiario() {
  filaHoje = [];
  disparosFeitos = 0;
  mensagensProcessadas.clear(); // limpa o Set também
  HORARIOS = gerarHorarios(); // ANTI-BAN: regenera horários para o novo dia
  salvarFila();
  log(
    "RESET",
    `Fila e contadores zerados para o novo dia | Novos horários: ${HORARIOS.join(", ")}`,
  );
}

// ─────────────────────────────────────────────
// CLIENTE WHATSAPP
// ─────────────────────────────────────────────

const client = new Client({
  authStrategy: new LocalAuth({ clientId: `scheduler-bot-${INSTANCIA}` }),
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
  log("BOT", "Cliente WhatsApp pronto ✓");
  filaHoje = carregarFila();
  // Recalcula disparosFeitos com base na fila carregada
  disparosFeitos = filaHoje.filter((m) => m.status === "enviado").length;
  log(
    "BOT",
    `Fila carregada: ${filaHoje.length} mensagem(ns) | ${disparosFeitos} já disparadas`,
  );
  agendarDisparos();
});

client.on("auth_failure", (msg) => {
  log("ERRO", `Falha de autenticação: ${msg}`);
});

client.on("disconnected", (reason) => {
  log("AVISO", `Desconectado: ${reason}`);
});

// ─────────────────────────────────────────────
// RECEPÇÃO DAS MENSAGENS (enviadas para si mesmo)
// ─────────────────────────────────────────────

client.on("message_create", async (msg) => {
  const meuId = client.info.wid._serialized;
  const destinatario = msg.to;

  // console.log(`Remetente: ${remetente}, Destinatário: ${destinatario}`);

  if (!msg.fromMe || destinatario !== meuId) return;

  // Ignora respostas automáticas do próprio bot (evita loop)
  const prefixosBot = ["✅", "⚠️", "📊", "🗑️", "📋", "📤"];
  if (prefixosBot.some((p) => msg.body.startsWith(p))) return;

  // FIX 1: ignora mensagem se já foi processada
  const msgId = msg.id._serialized;
  if (mensagensProcessadas.has(msgId)) return;
  mensagensProcessadas.add(msgId);

  // Comando: "!status"
  if (msg.body.trim().toLowerCase() === "!status") {
    const status =
      `📊 *Status do Bot*\n\n` +
      `📨 Mensagens na fila: ${filaHoje.length}/10\n` +
      `✅ Disparos realizados hoje: ${disparosFeitos}/${HORARIOS.length}\n` +
      `⏳ Próximo disparo: ${proximoHorario()}\n\n` +
      `_Mensagens agendadas:_\n` +
      filaHoje.map((m, i) => `${i + 1}. ${m.preview}`).join("\n");
    await msg.reply(status);
    return;
  }

  // Comando: "!limpar"
  if (msg.body.trim().toLowerCase() === "!limpar") {
    filaHoje = [];
    disparosFeitos = 0;
    mensagensProcessadas.clear();
    salvarFila();
    await msg.reply("🗑️ Fila limpa com sucesso.");
    log("COMANDO", "Fila limpa manualmente");
    return;
  }

  // Comando: "!grupos"
  if (msg.body.trim().toLowerCase() === "!grupos") {
    const chats = await client.getChats();
    const grupos = chats.filter((c) => c.isGroup);
    const lista = grupos
      .map((g) => `• ${g.name}\n  ID: \`${g.id._serialized}\``)
      .join("\n\n");
    await msg.reply(`📋 *Grupos disponíveis:*\n\n${lista}`);
    return;
  }

  // Mensagem normal → adiciona à fila
  if (filaHoje.length >= 10) {
    await msg.reply(
      "⚠️ A fila já está cheia (10/10 mensagens). Envie *!limpar* para reiniciar.",
    );
    return;
  }

  const bairroExtraido = extrairBairro(msg.body);
  const classeAnuncio = classificarBairro(bairroExtraido);
  const gruposDestino = resolverGrupos(classeAnuncio);

  const entrada = {
    indice: filaHoje.length,
    corpo: msg.body,
    preview: msg.body.substring(0, 60) + (msg.body.length > 60 ? "…" : ""),
    recebidoEm: new Date().toISOString(),
    disparadoEm: null,
    status: "aguardando",
    bairro: bairroExtraido || "não identificado",
    classe: classeAnuncio,
    gruposDestino: gruposDestino,
  };

  filaHoje.push(entrada);
  salvarFila();

  const horarioDestinado = HORARIOS[entrada.indice] || "—";
  const classeTexto =
    classeAnuncio === "GERAL"
      ? "⚠️ não identificado — só grupos gerais"
      : `✅ *${classeAnuncio}*`;
  await msg.reply(
    `✅ *Mensagem ${filaHoje.length}/10 recebida!*\n\n` +
      `📍 Bairro detectado: *${bairroExtraido || "não identificado"}*\n` +
      `🏷️ Classe: ${classeTexto}\n` +
      `📢 Grupos destino: *${gruposDestino.length}*\n\n` +
      `⏰ Será disparada às *${horarioDestinado}*`,
  );
  log(
    "RECEBIDA",
    `Msg ${filaHoje.length} | bairro: ${bairroExtraido} | classe: ${classeAnuncio} | grupos: ${gruposDestino.length}`,
  );
});

// ─────────────────────────────────────────────
// AGENDAMENTO DOS DISPAROS
// ─────────────────────────────────────────────

function proximoHorario() {
  const agora = new Date();
  const hhmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const proximo = HORARIOS.find((h) => h > hhmm);
  return proximo || "Nenhum hoje (todos passaram)";
}

function agendarDisparos() {
  HORARIOS.forEach((horario, indice) => {
    const [hora, minuto] = horario.split(":");
    const expressao = `${minuto} ${hora} * * *`;

    cron.schedule(
      expressao,
      async () => {
        await executarDisparo(indice);
      },
      { timezone: "America/Sao_Paulo" },
    );

    log("CRON", `Agendado slot ${indice + 1} para ${horario}`);
  });

  // Reset diário às 19:00 (após o último disparo)
  cron.schedule("0 19 * * *", resetarDiario, { timezone: "America/Sao_Paulo" });

  log("CRON", `${HORARIOS.length} horários agendados ✓`);
}

async function executarDisparo(indice) {
  log("DISPARO", `Iniciando slot ${indice + 1} (${HORARIOS[indice]})`);

  if (indice >= filaHoje.length) {
    log("AVISO", `Slot ${indice + 1}: sem mensagem na fila para este horário`);
    return;
  }

  const mensagem = filaHoje[indice];

  // FIX 2: proteção dupla contra disparo duplicado
  if (mensagem.status === "enviado") {
    log("AVISO", `Slot ${indice + 1}: já enviado, ignorando`);
    return;
  }

  // Marca como "enviando" imediatamente para bloquear chamadas simultâneas
  filaHoje[indice].status = "enviando";
  salvarFila();

  let sucessos = 0;
  let falhas = 0;

  // ANTI-BAN: embaralha a ordem de envio dos grupos
  const gruposDestino = embaralhar(mensagem.gruposDestino || GRUPOS_GERAIS);

  log(
    "DISPARO",
    `Slot ${indice + 1} | bairro: ${mensagem.bairro || "—"} | classe: ${mensagem.classe || "GERAL"} | ${gruposDestino.length} grupos`,
  );

  for (let i = 0; i < gruposDestino.length; i++) {
    const grupoId = gruposDestino[i];
    try {
      const chat = await client.getChatById(grupoId);
      await chat.sendMessage(mensagem.corpo);
      log("ENVIADO", `Slot ${indice + 1} → ${chat.name || grupoId}`);
      sucessos++;

      // ANTI-BAN: pausa longa a cada 5 envios para simular comportamento humano
      if ((i + 1) % 5 === 0) {
        await sleep(15000 + Math.random() * 20000); // 15–35s
      } else {
        // ANTI-BAN: delay variável entre envios individuais
        await sleep(4000 + Math.random() * 8000); // 4–12s
      }
    } catch (err) {
      log("ERRO", `Slot ${indice + 1} → ${grupoId}: ${err.message}`);
      falhas++;
    }
  }

  // FIX 3: atualiza estado e incrementa contador UMA única vez, fora do loop
  filaHoje[indice].status =
    falhas === gruposDestino.length ? "erro" : "enviado";
  filaHoje[indice].disparadoEm = new Date().toISOString();
  filaHoje[indice].resultado = { sucessos, falhas };
  disparosFeitos++; // ← fora do loop, incrementa 1 por slot
  salvarFila();

  log(
    "DISPARO",
    `Slot ${indice + 1} concluído — ${sucessos} ok, ${falhas} falhas`,
  );

  // Notifica via mensagem para si mesmo
  try {
    const meuId = client.info.wid._serialized;
    await client.sendMessage(
      meuId,
      `📤 *Disparo ${indice + 1}/10 concluído* (${HORARIOS[indice]})\n\n` +
        `✅ Enviado para ${sucessos} grupo(s)\n` +
        (falhas > 0 ? `❌ Falhou em ${falhas} grupo(s)\n` : "") +
        `📝 "${mensagem.preview}"`,
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

client.initialize();
