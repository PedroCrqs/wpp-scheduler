# Changelog

All notable changes to this project will be documented in this file.
Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
