# Changelog

All notable changes to this project will be documented in this file.
Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [3.0.0] - 2026-XX-XX

### Changed (Breaking)

- Refactored monolithic main.js into modular architecture (src/)
- New entry point: index.js
- Centralized mutable state in src/state.js

### Fixed

- !clear command now re-schedules cron tasks after generating new schedule
- shuffle() replaced with unbiased Fisher-Yates algorithm
- ready handler made async for proper log sequencing
- Removed dead code: BARRA_E_OLIMPICA class
- Runtime data (queues, schedules, logs, sessions) moved from project root into `data/` subdirectories — prevents data files from mixing with source code and avoids accidental commits of sensitive session data
- `LocalAuth` now receives an explicit `dataPath` pointing to `data/sessions/` — session location is no longer dependent on `process.cwd()`, making PM2 and multi-directory setups reliable

## [2.1.2] - 2026-03-28

### Fixed

- **Dispatch Queue Race Condition:** Fixed critical bug where a slot could be silently dropped when its CRON trigger fired while another dispatch was already running.
- **Root cause:** `processDispatchQueue()` was called recursively without `await` inside the `finally` block — under certain Node.js event loop timing, `pendingDispatches` appeared empty at the moment of the recursive call, leaving the slot permanently stuck.
- **Fix:** Replaced the recursive pattern with a `while` loop that drains the entire `pendingDispatches` queue sequentially. Any slot added during an active dispatch is guaranteed to be picked up when the current one finishes.

## [2.1.1] - 2026-03-27

### Fixed

- **Persistent Scheduling Bug:** Fixed critical issue where the bot stopped dispatching after the first day without a manual restart.
- **Dynamic Re-scheduling:** `dailyReset()` now explicitly calls `scheduleDispatches()` to register the new day's random time slots.
- **CRON Resource Management:** `scheduleDispatches()` now tracks and destroys previous `node-cron` instances before creating new ones, preventing "ghost" triggers from firing at old times.
- **Trigger Isolation:** Moved the master daily reset CRON (19:00) out of the `scheduleDispatches` scope to global initialization to ensure the reset logic itself remains stable and unique.

## [2.1.0] - 2026-03-26

### Added

- Catch-up mechanism for missed dispatch slots on restart
- `scheduleDispatches()` now detects past slots still in `waiting` state and triggers them immediately

### Fixed

- Date comparison now uses `America/Sao_Paulo` timezone instead of UTC
- Prevents messages from being incorrectly discarded near midnight boundary

## [2.0.1] - 2026-03-25

### Fixed

- Preview generation now extracts structured title line (`*• ...* - _..._`) using regex instead of naive substring
- Prevents inconsistent previews caused by variable message length and formatting

## [2.0.0] - 2026-03-25

### Changed

- Codebase migrated to English (variables, functions, commands, constants)
- Commands renamed: `!status` → `!status`, `!limpar` → `!clear`, `!grupos` → `!groups`
- Queue file renamed from `fila-{instance}.json` → `queue-{instance}.json`
- Internal state fields renamed to English (`corpo` → `body`, `recebidoEm` → `receivedAt`, etc.)
- `CONTAS` → `ACCOUNTS`, `INSTANCIA` → `INSTANCE`, `HORARIOS` → `SCHEDULE`
- `gruposGerais` / `gruposEspecificos` → `generalGroups` / `specificGroups`
- `classe` → `class`, `bairro` → `neighborhood`, `sucessos/falhas` → `successes/failures`

### Added

- `!fire` command — immediately dispatches the next pending slot
- `!fire <n>` command — immediately dispatches slot n (1-based index)
- Sequential dispatch queue (`pendingDispatches` + `dispatchRunning` flag) — next dispatch only starts after previous one fully completes
- Schedule persistence via `schedule-{instance}.json` — bot restart no longer regenerates schedule times
- `schedule-{instance}.json` is only regenerated on daily reset (19:00) or `!clear`

### Fixed

- Async file I/O (`fs.promises`) for log and queue writes — prevents event loop blocking that caused node-cron `missed execution` warnings
- Duplicate group IDs now deduplicated via `Set` in `resolveGroups()`
- `!status` now shows per-message status (`[waiting]`, `[sending]`, `[sent]`, `[error]`)

---

## [1.8.0] - 2026-03-24

### Added

- `meuBsuid` field per instance in `CONTAS` config with hardcoded `@lid` value
- `meuBsuid` assigned on `ready` from instance config

### Fixed

- Self-chat detection now uses exact `@lid` BSUID match instead of unreliable number comparison
- Added fallback check against `meuId` (`@c.us`) for extra safety

## [1.7.0] - 2026-03-23

### Fixed

- Self chat now uses only negative from self id to detection

---

## [1.6.0] - 2026-03-23

### Fixed

- Handle `@lid` vs `@c.us` format mismatch in self-chat detection
- Self-chat filter now compares numbers only, ignoring suffix differences

---

## [1.5.0] - 2026-03-23

### Fixed

- Bot was responding in group chats when queue was full
- Replaced `message_create` logic that blocked all private messages
- Filter now correctly uses `msg.to` to detect group destination
- Self-chat detection restricted to chat "Você" only, ignoring messages to other contacts

---

## [1.4.0] - 2026-03-23

### Changed

- Migrated from `message` event to `message_create` to support self-chat (chat "Você")
- Removed hardcoded `MEU_NUMERO` — bot number now resolved dynamically via `client.info.wid._serialized`

---

## [1.3.0] - 2026-03-23

### Added

- Multi-instance support via `process.argv` (`node main.js conta1`, `node main.js conta2`)
- Each instance has its own `gruposGerais` and `gruposEspecificos` configuration
- Separate LocalAuth session per instance (`scheduler-bot-conta1`, `scheduler-bot-conta2`)

### Changed

- Groups configuration moved from flat arrays to `CONTAS` object grouped by instance

---

## [1.2.0] - 2026-03-23

### Added

- Neighborhood class detection from `_Bairro_` italic pattern in announcements
- `BAIRROS_CLASSE` keyword map for JACAREPAGUA, BARRA, BARRA_OLIMPICA, RECREIO, RECREIO_BARRA, VARGENS
- `extrairBairro()` — extracts neighborhood from message using regex
- `classificarBairro()` — classifies neighborhood into a class, accent and case insensitive
- `resolverGrupos()` — builds final group list combining general + eligible specific groups
- `GRUPOS_GERAIS` — groups that receive all announcements
- `GRUPOS_ESPECIFICOS` — groups that receive only matching neighborhood class
- RECREIO_BARRA class: receives both RECREIO and BARRA announcements
- BARRA_OLIMPICA class: also receives BARRA groups (as a sub-region)
- Confirmation reply now includes detected neighborhood, class, and group count
- `new Set()` deduplication on final group list to prevent double sends

### Fixed

- Removed duplicate group IDs that were causing double dispatch to same group

---

## [1.1.0] - 2026-03-21

### Added

- Anti-ban: randomized group send order using `embaralhar()`
- Anti-ban: variable delay between sends (4–12s), with longer pause every 5 groups (15–35s)
- Daily reset moved from midnight to 19:00 (after last dispatch at 18:30)
- Bot now recalculates `disparosFeitos` on startup based on saved queue status

### Fixed

- `disparosFeitos` counter was incrementing once per group instead of once per slot
- Slot now marked as `"enviando"` immediately on start to block simultaneous calls
- Added `mensagensProcessadas` Set to prevent same message being processed twice
- Post-dispatch notification now uses `meuId` correctly instead of appending `@c.us` to serialized ID

---

## [1.0.0] - 2026-03-20

### Added

- Initial bot using `whatsapp-web.js` with QR Code authentication via `LocalAuth`
- 10 daily scheduled dispatches at broken times: 09:05, 10:08, 11:01, 12:15, 13:07, 14:22, 15:09, 16:29, 17:01, 18:30
- Message queue: receives up to 10 messages from personal number before first dispatch
- Each message mapped to a time slot by order of receipt
- `!status` command — shows queue, dispatches done and next scheduled time
- `!limpar` command — clears queue and resets counters
- `!grupos` command — lists all group IDs the bot is a member of
- Queue persisted to `fila.json` — survives bot restarts within the same day
- Activity log persisted to `log.json` — keeps last 500 entries
- Post-dispatch notification sent to personal number with success/failure summary
- Daily reset at midnight via `node-cron`
- PM2 process manager setup with Windows Task Scheduler for auto-start
