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
  resetSchedulerInitialized: false,
  resetTimer: null,
  resetFiredAt: null,
  resetCronInitialized: false,
};

module.exports = state;
