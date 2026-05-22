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

const { copyFile, open, unlink } = require("fs/promises");
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

// Lock file no mesmo diretório do Drive para coordenar instâncias concorrentes.
// Qualquer instância que queira executar autoFeedQueue deve adquirir este lock primeiro.
const LOCK_PATH = "/home/pedrocrqs/majesto-drive/.autoqueue.lock";
const LOCK_TIMEOUT_MS = 60_000; // abandona se outra instância travar por mais de 60s

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

// ─── Lock distribuído (arquivo no Drive) ─────────────────────────────────────

/**
 * Tenta adquirir o lock de exclusão mútua no Drive.
 *
 * Usa "wx" (write + exclusive) — falha atomicamente se o arquivo já existir.
 * Se o lock existir mas for mais antigo que LOCK_TIMEOUT_MS, considera travado
 * e o remove antes de tentar novamente.
 *
 * Retorna true se adquiriu o lock, false se outra instância está executando.
 */
async function acquireLock() {
  try {
    const fh = await open(LOCK_PATH, "wx");
    await fh.writeFile(JSON.stringify({ instance: INSTANCE, at: Date.now() }));
    await fh.close();
    return true;
  } catch (err) {
    if (err.code !== "EEXIST") {
      await persistence.log("LOCK", `Unexpected lock error: ${err.message}`);
      return false;
    }

    // Lock existe — verifica se está travado (instância morreu sem liberar)
    try {
      const fh = await open(LOCK_PATH, "r");
      const content = await fh.readFile("utf8");
      await fh.close();
      const { at } = JSON.parse(content);
      if (Date.now() - at > LOCK_TIMEOUT_MS) {
        await persistence.log(
          "LOCK",
          `Stale lock detected (>${LOCK_TIMEOUT_MS}ms) — forcibly releasing.`,
        );
        await unlink(LOCK_PATH);
        return acquireLock(); // tenta novamente
      }
    } catch {
      // arquivo sumiu entre o open e o readFile — tenta adquirir de novo
      return acquireLock();
    }

    return false;
  }
}

async function releaseLock() {
  try {
    await unlink(LOCK_PATH);
  } catch (err) {
    await persistence.log("LOCK", `Failed to release lock: ${err.message}`);
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

/**
 * Registra os imóveis no ciclo da instância.
 *
 * IMPORTANTE: deve ser chamada pelo dispatcher APÓS confirmação de envio,
 * não no momento da reserva — evita queimar imóveis do ciclo em caso de
 * falha entre reserva e despacho real.
 *
 * Abre e fecha o próprio banco para poder ser chamada de fora deste módulo
 * (ex: dispatcher.js), após o upload ter sido feito pelo autoFeedQueue.
 * Por isso usa doBackup internamente para manter Drive sincronizado.
 */
async function markAsSentInCycle(imovelIds, instance) {
  let db;
  try {
    await doBackup("download");
    db = new DatabaseSync(DB_PATH);
    const today = todaySP();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO Dispatch_Cycle (ImovelID, Instance, SentAt) VALUES (?, ?, ?)
    `);
    for (const id of imovelIds) stmt.run(id, instance, today);
    db.close();
    db = null;
    await doBackup("upload");
    await persistence.log(
      "AUTO-SCHEDULER",
      `Cycle marked for IDs [${imovelIds.join(", ")}] (${instance})`,
    );
  } catch (err) {
    await persistence.log(
      "AUTO-SCHEDULER",
      `markAsSentInCycle error: ${err.message}`,
    );
  } finally {
    db?.close();
  }
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

    // NÃO marca o ciclo aqui — isso é feito pelo dispatcher após envio confirmado.

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

async function clearTodayReservations() {
  const today = todaySP();
  let db;
  try {
    await doBackup("download"); // 👈 pega versão mais recente do Drive
    db = new DatabaseSync(DB_PATH);
    const result = db
      .prepare("DELETE FROM Dispatched_Today WHERE Reserved_At = ?")
      .run(today);
    db.close();
    db = null;
    await doBackup("upload"); // 👈 salva no Drive com as reservas removidas
    if (result.changes > 0) {
      await persistence.log(
        "AUTO-SCHEDULER",
        `${result.changes} today's reservation(s) cleared.`,
      );
    }
  } catch (err) {
    await persistence.log(
      "AUTO-SCHEDULER",
      `Error clearing today's reservations: ${err.message}`,
    );
  } finally {
    db?.close();
  }
}

module.exports = {
  fetchAndReserveAnnouncements,
  clearTodayReservations,
  pruneOldReservations,
  markAsSentInCycle,
  doBackup,
  acquireLock,
  releaseLock,
};
