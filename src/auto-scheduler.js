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
 * NOTA DE MIGRAÇÃO (SQLite → PostgreSQL):
 *
 *   A versão anterior usava `node:sqlite` direto no arquivo imoveis.db,
 *   e precisava de um lock distribuído via arquivo no Drive (acquireLock/
 *   releaseLock) + cópia do .db antes/depois de cada operação (doBackup),
 *   só para coordenar as 3 instâncias (account1/2/3) escrevendo no mesmo
 *   arquivo sem corromper nada.
 *
 *   Com PostgreSQL isso deixa de ser necessário: a reserva de imóveis
 *   (fetchAndReserveAnnouncements) roda inteira dentro de uma transação
 *   com `INSERT ... ON CONFLICT DO NOTHING RETURNING`, que é atômico —
 *   o próprio banco garante que duas instâncias nunca reservem o mesmo
 *   imóvel no mesmo dia, sem precisar de lock de arquivo nem sync manual.
 */

const { pool } = require("./db");
const {
  extractNeighborhood,
  classifyNeighborhood,
  resolveGroups,
} = require("./neighborhood");
const { mergeFormat, mergeFormat2 } = require("./format");
const { INSTANCE } = require("./config");
const persistence = require("./persistence");

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

// ─── Ciclo por instância ──────────────────────────────────────────────────────

async function getAvailableForCycle(client, instance) {
  let { rows } = await client.query(
    `
      SELECT ImovelID
      FROM   Imoveis
      WHERE  ImovelStatus = 'Disponível'
        AND  ImovelID NOT IN (
               SELECT ImovelID FROM Dispatch_Cycle WHERE Instance = $1
             )
      ORDER BY ImovelID ASC
    `,
    [instance],
  );

  if (rows.length > 0) return rows.map((r) => r.imovelid);

  await client.query("DELETE FROM Dispatch_Cycle WHERE Instance = $1", [
    instance,
  ]);
  await persistence.log(
    "AUTO-SCHEDULER",
    `Cycle completed for ${instance} — resetting.`,
  );

  ({ rows } = await client.query(
    `SELECT ImovelID FROM Imoveis WHERE ImovelStatus = 'Disponível' ORDER BY ImovelID ASC`,
  ));
  return rows.map((r) => r.imovelid);
}

// ─── Reserva diária (atômica via ON CONFLICT DO NOTHING) ─────────────────────

/**
 * Tenta reservar os IDs em `ids` para hoje. Usa ON CONFLICT DO NOTHING +
 * RETURNING: cada linha realmente inserida é uma reserva bem-sucedida.
 * Se outra instância reservou um dos IDs entre a leitura e essa escrita,
 * essa linha simplesmente não volta no RETURNING — sem erro, sem lock.
 */
async function reserveForToday(client, ids, instance) {
  if (ids.length === 0) return [];
  const today = todaySP();

  const values = ids.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(", ");
  const params = ids.flatMap((id) => [id, instance, today]);

  const { rows } = await client.query(
    `
      INSERT INTO Dispatched_Today (ImovelID, Instance, Reserved_At)
      VALUES ${values}
      ON CONFLICT (ImovelID, Reserved_At) DO NOTHING
      RETURNING ImovelID
    `,
    params,
  );

  return rows.map((r) => r.imovelid);
}

/**
 * Registra os imóveis no ciclo da instância.
 *
 * IMPORTANTE: deve ser chamada pelo dispatcher APÓS confirmação de envio,
 * não no momento da reserva — evita queimar imóveis do ciclo em caso de
 * falha entre reserva e despacho real.
 */
async function markAsSentInCycle(imovelIds, instance) {
  if (imovelIds.length === 0) return;
  const today = todaySP();

  try {
    const values = imovelIds
      .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
      .join(", ");
    const params = imovelIds.flatMap((id) => [id, instance, today]);

    await pool.query(
      `
        INSERT INTO Dispatch_Cycle (ImovelID, Instance, SentAt)
        VALUES ${values}
        ON CONFLICT (ImovelID, Instance) DO NOTHING
      `,
      params,
    );

    await persistence.log(
      "AUTO-SCHEDULER",
      `Cycle marked for IDs [${imovelIds.join(", ")}] (${instance})`,
    );
  } catch (err) {
    await persistence.log(
      "AUTO-SCHEDULER",
      `markAsSentInCycle error: ${err.message}`,
    );
  }
}

// ─── Feed principal ───────────────────────────────────────────────────────────

async function fetchAndReserveAnnouncements(limit = 14) {
  const today = todaySP();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: takenRows } = await client.query(
      "SELECT ImovelID FROM Dispatched_Today WHERE Reserved_At = $1",
      [today],
    );
    const takenToday = new Set(takenRows.map((r) => r.imovelid));

    const cycleAvailable = await getAvailableForCycle(client, INSTANCE);
    const candidates = cycleAvailable.filter((id) => !takenToday.has(id));

    if (candidates.length === 0) {
      await client.query("COMMIT");
      await persistence.log(
        "AUTO-SCHEDULER",
        `No candidates for ${INSTANCE} today.`,
      );
      return [];
    }

    // Tenta reservar o primeiro lote; se ON CONFLICT descartar alguns
    // (corrida com outra instância), completa com o restante dos
    // candidatos até atingir o limite.
    let reserved = await reserveForToday(client, candidates.slice(0, limit), INSTANCE);

    if (reserved.length < limit) {
      const reservedSet = new Set(reserved);
      const remaining = candidates
        .slice(limit)
        .filter((id) => !reservedSet.has(id));
      const complement = await reserveForToday(
        client,
        remaining.slice(0, limit - reserved.length),
        INSTANCE,
      );
      if (complement.length > 0) {
        reserved = reserved.concat(complement);
        await persistence.log(
          "AUTO-SCHEDULER",
          `Race condition: +${complement.length} complemented.`,
        );
      }
    }

    if (reserved.length === 0) {
      await client.query("COMMIT");
      await persistence.log(
        "AUTO-SCHEDULER",
        "No properties reserved — all taken today.",
      );
      return [];
    }

    await persistence.log(
      "AUTO-SCHEDULER",
      `${reserved.length} property(ies) reserved for ${INSTANCE} (IDs: ${reserved.join(", ")})`,
    );

    const { rows } = await client.query(
      `SELECT ImovelID, Descricao FROM Imoveis WHERE ImovelID = ANY($1) ORDER BY ImovelID ASC`,
      [reserved],
    );

    await client.query("COMMIT");

    return rows.map((row, i) => {
      const body = applyFormat(row.descricao ?? "");
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
        sourceImovelID: row.imovelid,
      };
    });
  } catch (err) {
    await client.query("ROLLBACK");
    await persistence.log(
      "AUTO-SCHEDULER",
      `Error fetching announcements: ${err.message}`,
    );
    return [];
  } finally {
    client.release();
  }
}

// ─── Limpeza ──────────────────────────────────────────────────────────────────

async function pruneOldReservations() {
  const today = todaySP();
  try {
    const result = await pool.query(
      "DELETE FROM Dispatched_Today WHERE Reserved_At < $1",
      [today],
    );
    if (result.rowCount > 0) {
      await persistence.log(
        "AUTO-SCHEDULER",
        `${result.rowCount} old reservation(s) removed.`,
      );
    }
  } catch (err) {
    await persistence.log(
      "AUTO-SCHEDULER",
      `Error pruning reservations: ${err.message}`,
    );
  }
}

async function clearTodayReservations() {
  const today = todaySP();
  try {
    const result = await pool.query(
      "DELETE FROM Dispatched_Today WHERE Reserved_At = $1",
      [today],
    );
    if (result.rowCount > 0) {
      await persistence.log(
        "AUTO-SCHEDULER",
        `${result.rowCount} today's reservation(s) cleared.`,
      );
    }
  } catch (err) {
    await persistence.log(
      "AUTO-SCHEDULER",
      `Error clearing today's reservations: ${err.message}`,
    );
  }
}

module.exports = {
  fetchAndReserveAnnouncements,
  clearTodayReservations,
  pruneOldReservations,
  markAsSentInCycle,
};
