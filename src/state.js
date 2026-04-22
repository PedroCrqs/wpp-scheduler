const state = {
  todayQueue: [],
  dispatchesDone: 0,
  SCHEDULE: [],
  dispatchRunning: false,
  pendingDispatches: [],
  processedMessages: new Set(),
  slotCronTasks: [],
  myBsuid: null,
  client: null,
  resetCronTask: null,
  resetCronInitialized: false,
  watchdogScheduled: new Set(),
  scheduleDate: null,
  bootRecoveredAt: null,
};

module.exports = state;
