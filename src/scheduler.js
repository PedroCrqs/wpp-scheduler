import state from state.js
import * as config from config.js
import * as persistence from persistence.js

function generateSchedule() {
  const base = [
    { hour: 9, minute: 0 },
    { hour: 10, minute: 0 },
    { hour: 11, minute: 0 },
    { hour: 12, minute: 0 },
    { hour: 13, minute: 0 },
    { hour: 14, minute: 0 },
    { hour: 15, minute: 0 },
    { hour: 16, minute: 0 },
    { hour: 17, minute: 0 },
    { hour: 18, minute: 0 },
  ];
  return base.map(({ hour, minute }) => {
    const jitter = Math.floor(Math.random() * 30); // 0–29 min
    const newMinute = minute + jitter;
    return `${String(hour).padStart(2, "0")}:${String(newMinute).padStart(2, "0")}`;
  });
}

function nextScheduledTime() {
  const hhmm = new Date()
    .toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "")
    .trim();
  const next = state.SCHEDULE.find((h) => h > hhmm);
  return next || "None today (all passed)";
}

function scheduleDispatches() {
  state.slotCronTasks.forEach((task) => task.destroy());
  state.slotCronTasks = [];

  SCHEDULE.forEach((time, index) => {
    const [hour, minute] = time.split(":");
    const expression = `${minute} ${hour} * * *`;

    const task = cron.schedule(
      expression,
      async () => {
        await log("CRON", `Trigger for slot ${index + 1} (${time})`);
        queueDispatch(index);
      },
      { timezone: "America/Sao_Paulo" },
    );

    state.slotCronTasks.push(task);
    log("CRON", `Scheduled slot ${index + 1} at ${time}`);
  });

  log("CRON", `${state.SCHEDULE.length} slots scheduled ✓`);
}

async function dailyReset() {
  state.todayQueue = [];
  state.dispatchesDone = 0;
  state.processedMessages.clear();
  state.SCHEDULE = generateSchedule(); 
  persistence.saveSchedule();
  await persistence.saveQueue();
  await persistence.log(
    "RESET",
    `Queue and counters cleared | New schedule: ${SCHEDULE.join(", ")}`,
  );
  scheduleDispatches();
}
