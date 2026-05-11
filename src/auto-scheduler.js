/**
 * auto-scheduler.js
 *
 * Regras de despacho:
 *
 *   1. Nenhum robô pode enviar o mesmo imóvel no mesmo dia
 *      (coordenação via Dispatched_Today, PRIMARY KEY em ImovelID + Reserved_At).
 *
 *   2. Cada robô percorre a tabela Imoveis em ciclos independentes.
 *      Um imóvel só pode ser reenviado pela mesma instância quando
 *      todos os imóveis disponíveis já tiverem sido enviados por ela
 *      ao menos uma vez (Dispatch_Cycle rastreia o progresso do ciclo).
 *
 * Tabelas necessárias (schema.sql):
 *
 *   Dispatched_Today — deduplicação diária entre instâncias
 *     ImovelID    INTEGER  PK parcial (com Reserved_At)
 *     Instance    TEXT
 *     Reserved_At TEXT     YYYY-MM-DD
 *
 *   Dispatch_Cycle — progresso do ciclo por instância
 *     ImovelID    INTEGER  PK parcial (com Instance)
 *     Instance    TEXT
 *     SentAt      TEXT     YYYY-MM-DD
 */

const { copyFile } = require("fs/promises");
const { DatabaseSync } = require("node:sqlite");
const {
  extractNeighborhood,
  classifyNeighborhood,
  resolveGroups,
} = require("./neighborhood");
const { mergeFormat, mergeFormat2 } = require("./format");
const { INSTANCE } = require("./config");
const persistence = require("./persistence");

const DB_PATH =
  "/home/pedrocrqs/main-project-database/imoveis-database/data/imoveis.db";
const DRIVE_PATH = "/home/pedrocrqs/majesto-drive/imoveis.db";

function todaySP() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

function applyFormat(body) {
  if (INSTANCE === "account3") return mergeFormat(body);
  if (INSTANCE === "account1") return mergeFormat2(body);
  return body;
}

// ─── Backup ───────────────────────────────────────────────────────────────────

/**
 * Sincroniza o banco com o Drive.
 *   "download" — Drive → local  (antes de ler dados)
 *   "upload"   — local → Drive  (após escrever dados)
 *
 * Usa fs/promises.copyFile que retorna uma Promise real,
 * garantindo que o await em autoFeedQueue bloqueie corretamente.
 */
async function doBackup(direction) {
  try {
    if (direction === "download") {
      await copyFile(DRIVE_PATH, DB_PATH);
      await persistence.log("BACKUP", "Drive → local sync complete.");
    } else if (direction === "upload") {
      await copyFile(DB_PATH, DRIVE_PATH);
      await persistence.log("BACKUP", "Local → Drive sync complete.");
    }
  } catch (err) {
    await persistence.log(
      "BACKUP",
      `Sync failed (${direction}): ${err.message}`,
    );
  }
}

// ─── Ciclo por instância ──────────────────────────────────────────────────────

function getAvailableForCycle(db, instance) {
  const available = db
    .prepare(
      `
    SELECT ImovelID
    FROM   Imoveis
    WHERE  ImovelStatus = 'Disponível'
      AND  ImovelID NOT IN (
             SELECT ImovelID FROM Dispatch_Cycle WHERE Instance = ?
           )
    ORDER BY ImovelID ASC
  `,
    )
    .all(instance);

  if (available.length > 0) return available.map((r) => r.ImovelID);

  db.prepare("DELETE FROM Dispatch_Cycle WHERE Instance = ?").run(instance);
  persistence.log(
    "AUTO-SCHEDULER",
    `Cycle completed for ${instance} — resetting.`,
  );

  return db
    .prepare(
      `
    SELECT ImovelID FROM Imoveis WHERE ImovelStatus = 'Disponível' ORDER BY ImovelID ASC
  `,
    )
    .all()
    .map((r) => r.ImovelID);
}

// ─── Reserva diária ───────────────────────────────────────────────────────────

function reserveForToday(db, ids, instance) {
  const today = todaySP();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO Dispatched_Today (ImovelID, Instance, Reserved_At)
    VALUES (?, ?, ?)
  `);
  const reserved = [];
  for (const id of ids) {
    const result = insert.run(id, instance, today);
    if (result.changes > 0) reserved.push(id);
  }
  return reserved;
}

function markAsSentInCycle(db, imovelIds, instance) {
  const today = todaySP();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO Dispatch_Cycle (ImovelID, Instance, SentAt) VALUES (?, ?, ?)
  `);
  for (const id of imovelIds) stmt.run(id, instance, today);
}

// ─── Feed principal ───────────────────────────────────────────────────────────

async function fetchAndReserveAnnouncements(limit = 14) {
  const today = todaySP();
  let db;

  try {
    db = new DatabaseSync(DB_PATH);
  } catch (err) {
    await persistence.log(
      "AUTO-SCHEDULER",
      `Failed to open database: ${err.message}`,
    );
    return [];
  }

  try {
    const takenToday = new Set(
      db
        .prepare("SELECT ImovelID FROM Dispatched_Today WHERE Reserved_At = ?")
        .all(today)
        .map((r) => r.ImovelID),
    );

    const cycleAvailable = getAvailableForCycle(db, INSTANCE);
    const candidates = cycleAvailable.filter((id) => !takenToday.has(id));

    if (candidates.length === 0) {
      await persistence.log(
        "AUTO-SCHEDULER",
        `No candidates for ${INSTANCE} today.`,
      );
      return [];
    }

    const reserved = reserveForToday(db, candidates.slice(0, limit), INSTANCE);

    // Complementa se houve corrida entre instâncias
    if (reserved.length < limit) {
      const reservedSet = new Set(reserved);
      const remaining = candidates
        .slice(limit)
        .filter((id) => !reservedSet.has(id));
      const complement = reserveForToday(
        db,
        remaining.slice(0, limit - reserved.length),
        INSTANCE,
      );
      if (complement.length > 0) {
        reserved.push(...complement);
        await persistence.log(
          "AUTO-SCHEDULER",
          `Race condition: +${complement.length} complemented.`,
        );
      }
    }

    if (reserved.length === 0) {
      await persistence.log(
        "AUTO-SCHEDULER",
        "No properties reserved — all taken today.",
      );
      return [];
    }

    markAsSentInCycle(db, reserved, INSTANCE);

    await persistence.log(
      "AUTO-SCHEDULER",
      `${reserved.length} property(ies) reserved for ${INSTANCE} (IDs: ${reserved.join(", ")})`,
    );

    const placeholders = reserved.map(() => "?").join(",");
    const rows = db
      .prepare(
        `
      SELECT ImovelID, Descricao FROM Imoveis
      WHERE ImovelID IN (${placeholders}) ORDER BY ImovelID ASC
    `,
      )
      .all(...reserved);

    return rows.map((row, i) => {
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
        sourceImovelID: row.ImovelID,
      };
    });
  } catch (err) {
    await persistence.log(
      "AUTO-SCHEDULER",
      `Error fetching announcements: ${err.message}`,
    );
    return [];
  } finally {
    db.close();
  }
}

// ─── Limpeza ──────────────────────────────────────────────────────────────────

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
        `${result.changes} old reservation(s) removed.`,
      );
    }
  } catch (err) {
    await persistence.log(
      "AUTO-SCHEDULER",
      `Error pruning reservations: ${err.message}`,
    );
  } finally {
    db?.close();
  }
}

module.exports = {
  fetchAndReserveAnnouncements,
  pruneOldReservations,
  doBackup,
};
