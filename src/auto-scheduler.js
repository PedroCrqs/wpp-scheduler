/**
 * auto-scheduler.js
 *
 * Alimenta state.todayQueue automaticamente após qualquer reset,
 * buscando imóveis disponíveis na tabela Imoveis do SQLite.
 *
 * Coordenação entre instâncias (account1/2/3):
 *   A tabela Dispatched_Today (definida no schema.sql) registra
 *   quais ImovelIDs já foram reservados hoje por qualquer instância.
 *   A PRIMARY KEY (ImovelID, Reserved_At) é a trava atômica entre processos.
 */

const { DatabaseSync } = require("node:sqlite");
const {
  extractNeighborhood,
  classifyNeighborhood,
  resolveGroups,
} = require("./neighborhood");
const { mergeFormat, mergeFormat2 } = require("./format");
const { INSTANCE } = require("./config");
const persistence = require("./persistence");
const state = require("./state");

const DB_PATH =
  "/home/pedrocrqs/main-project-database/imoveis-database/data/imoveis.db";

// ─── Data de hoje no fuso de SP ──────────────────────────────────────────────
function todaySP() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

// ─── Formatação por instância ────────────────────────────────────────────────
function applyFormat(body) {
  if (INSTANCE === "account3") return mergeFormat(body);
  if (INSTANCE === "account1") return mergeFormat2(body);
  return body; // account2: sem alteração
}

/**
 * Reserva até `limit` imóveis disponíveis que ainda não foram
 * disparados hoje por nenhuma instância.
 *
 * @returns {Array} Entradas prontas para state.todayQueue
 */
async function fetchAndReserveAnnouncements(limit = 14) {
  const today = todaySP();
  let db;

  try {
    db = new DatabaseSync(DB_PATH);
  } catch (err) {
    await persistence.log(
      "AUTO-SCHEDULER",
      `Falha ao abrir database: ${err.message}`,
    );
    return [];
  }

  try {
    // ── Seleciona imóveis disponíveis ainda não reservados hoje ─────────────
    // Filtra ImovelStatus = 'Disponível' para não disparar imóveis fora de carteira.
    // Usa ImovelID (PK real) por consistência com o schema — não rowid.
    const rows = db
      .prepare(
        `
      SELECT ImovelID, Descricao
      FROM   Imoveis
      WHERE  ImovelStatus = 'Disponível'
        AND  ImovelID NOT IN (
               SELECT ImovelID
               FROM   Dispatched_Today
               WHERE  Reserved_At = ?
             )
      ORDER BY ImovelID ASC
      LIMIT ?
    `,
      )
      .all(today, limit);

    if (rows.length === 0) {
      await persistence.log(
        "AUTO-SCHEDULER",
        "Nenhum imóvel disponível no banco para hoje.",
      );
      return [];
    }

    // ── Reserva atômica via INSERT OR IGNORE ─────────────────────────────────
    // Se dois processos tentarem o mesmo ImovelID no mesmo dia,
    // a PRIMARY KEY rejeita o segundo silenciosamente (changes = 0).
    const insert = db.prepare(`
      INSERT OR IGNORE INTO Dispatched_Today (ImovelID, Instance, Reserved_At)
      VALUES (?, ?, ?)
    `);

    const reserved = [];
    for (const row of rows) {
      const result = insert.run(row.ImovelID, INSTANCE, today);
      if (result.changes > 0) {
        reserved.push(row);
      }
    }

    // ── Complementa se houve corrida entre instâncias ────────────────────────
    if (reserved.length < rows.length) {
      const missing = limit - reserved.length;
      const takenIds = reserved.map((r) => r.ImovelID);
      const placeholders =
        takenIds.length > 0 ? takenIds.map(() => "?").join(",") : "NULL";

      await persistence.log(
        "AUTO-SCHEDULER",
        `Corrida detectada: buscando ${missing} anúncio(s) complementar(es)…`,
      );

      const complement = db
        .prepare(
          `
        SELECT ImovelID, Descricao
        FROM   Imoveis
        WHERE  ImovelStatus = 'Disponível'
          AND  ImovelID NOT IN (
                 SELECT ImovelID FROM Dispatched_Today WHERE Reserved_At = ?
               )
          AND  ImovelID NOT IN (${placeholders})
        ORDER BY ImovelID ASC
        LIMIT ?
      `,
        )
        .all(today, ...takenIds, missing);

      for (const row of complement) {
        const result = insert.run(row.ImovelID, INSTANCE, today);
        if (result.changes > 0) reserved.push(row);
      }
    }

    await persistence.log(
      "AUTO-SCHEDULER",
      `${reserved.length} imóvel(is) reservado(s) para ${INSTANCE} ` +
        `(IDs: ${reserved.map((r) => r.ImovelID).join(", ")})`,
    );

    // ── Constrói entradas no formato de state.todayQueue ─────────────────────
    const entries = reserved.map((row, i) => {
      const body = applyFormat(row.Descricao ?? "");
      const neighborhood = extractNeighborhood(body);
      const announcementCls = classifyNeighborhood(neighborhood);
      const targetGroups = resolveGroups(announcementCls);
      const previewMatch = body.match(/\*•[^\n]+\* - _[^\n]+_/);

      return {
        index: i,
        body,
        preview: previewMatch?.[0] ?? body.substring(0, 60),
        receivedAt: new Date().toISOString(),
        dispatchedAt: null,
        status: "waiting",
        neighborhood: neighborhood || "unidentified",
        class: announcementCls,
        targetGroups,
        sourceImovelID: row.ImovelID, // rastreabilidade
      };
    });

    return entries;
  } catch (err) {
    await persistence.log(
      "AUTO-SCHEDULER",
      `Erro ao buscar anúncios: ${err.message}`,
    );
    return [];
  } finally {
    db.close();
  }
}

/**
 * Remove registros de dias anteriores da Dispatched_Today.
 * Chamado no início de cada autoFeedQueue para manter a tabela limpa.
 */
async function pruneOldReservations() {
  const today = todaySP();
  let db;
  try {
    db = new DatabaseSync(DB_PATH);
    const result = db
      .prepare("DELETE FROM Dispatched_Today WHERE Reserved_At < ?")
      .run(today);
    if (result.changes > 0) {
      await persistence.log(
        "AUTO-SCHEDULER",
        `${result.changes} reserva(s) antiga(s) removida(s).`,
      );
    }
  } catch (err) {
    await persistence.log(
      "AUTO-SCHEDULER",
      `Erro ao limpar reservas antigas: ${err.message}`,
    );
  } finally {
    db?.close();
  }
}

module.exports = { fetchAndReserveAnnouncements, pruneOldReservations };
