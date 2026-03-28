async function log(type, detail) {
  const entry = { ts: new Date().toISOString(), type, detail };
  console.log(`[${entry.ts}] [${type}]`, detail);

  try {
    let logs = [];
    try {
      const raw = await fsPromises.readFile(LOG_PATH, "utf8");
      logs = JSON.parse(raw);
    } catch {}
    logs.unshift(entry);
    if (logs.length > 500) logs = logs.slice(0, 500);
    await fsPromises.writeFile(LOG_PATH, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error("[LOG ERROR]", err.message);
  }
}

async function saveQueue() {
  await fsPromises.writeFile(QUEUE_PATH, JSON.stringify(todayQueue, null, 2));
}

function loadQueue() {
  try {
    const data = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8"));
    if (data.length > 0) {
      // Compara datas no fuso de Brasília para evitar descarte incorreto
      // quando receivedAt é madrugada UTC mas ainda é "hoje" em BRT
      const toSPDate = (d) =>
        new Date(d).toLocaleDateString("en-CA", {
          timeZone: "America/Sao_Paulo",
        });
      if (toSPDate(data[0].receivedAt) === toSPDate(new Date())) {
        return data;
      }
    }
  } catch {}
  return [];
}

function saveSchedule() {
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(SCHEDULE, null, 2));
}

function loadSchedule() {
  try {
    const data = JSON.parse(fs.readFileSync(SCHEDULE_PATH, "utf8"));
    if (Array.isArray(data) && data.length === 10) return data;
  } catch {}
  return null;
}

module.exports = { log, saveQueue, loadQueue, saveQueue, loadSchedule };
