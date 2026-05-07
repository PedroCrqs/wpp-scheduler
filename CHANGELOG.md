# Changelog

All notable changes to this project will be documented in this file.  
Todas as alterações relevantes deste projeto serão documentadas neste arquivo.

Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Baseado em [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [4.0.0] - 2026-05-05

### Added

- **`auto-scheduler.js` — new module for SQLite-driven queue auto-feed**
  - `fetchAndReserveAnnouncements(limit)`: selects up to 14 available properties (`ImovelStatus = 'Disponível'`) from the external `imoveis.db` database, respecting two independent rules:
    1. **Per-instance cycle** (`Dispatch_Cycle`): each instance cycles through all available properties before repeating any; cycle resets automatically when exhausted via `DELETE + re-query`
    2. **Cross-instance daily deduplication** (`Dispatched_Today`): atomic reservation via `INSERT OR IGNORE` on PRIMARY KEY `(ImovelID, Reserved_At)` — no two instances send the same property on the same day
  - `getAvailableForCycle(db, instance)`: queries properties not yet in `Dispatch_Cycle` for this instance; auto-resets cycle when all are exhausted
  - `reserveForToday(db, ids, instance)`: atomic `INSERT OR IGNORE` into `Dispatched_Today`; returns only IDs where `changes > 0`
  - `markAsSentInCycle(db, ids, instance)`: records sent IDs in `Dispatch_Cycle`
  - `pruneOldReservations()`: cleans `Dispatched_Today` entries older than today; `Dispatch_Cycle` is never pruned externally
  - Applies per-instance formatting: `mergeFormat` (account3), `mergeFormat2` (account1), raw (account2)
  - Builds queue entries with full neighborhood/class/targetGroups resolution
- **`helpers.js` — anti-ban utility module**
  - `sleep(ms)`: Promise-based delay
  - `shuffle(array)`: Fisher-Yates in-place shuffle (non-mutating via spread)
  - `microVary(text)`: inserts a random invisible Unicode character (`\u200B`, `\u200C`, `\u200D`, `\uFEFF`) at a random position — makes each message fingerprint unique to reduce WhatsApp pattern detection
  - `INVISIBLE_CHARS`: exported constant array for reference/testing
- **`autoFeedQueue()` in `scheduler.js`**: orchestrates `pruneOldReservations` + `fetchAndReserveAnnouncements(14)`; reindexes entries; sets `state.todayQueue`, resets `dispatchesDone`, calls `saveQueue()`; returns loaded count; exported for `client.js` boot
- **Boot auto-feed in `client.js`**: if `todayQueue` is empty after loading from disk on the `ready` event, `autoFeedQueue()` is called automatically before `scheduleDispatches()`
- **Post-cycle auto-reset in `dispatcher.js`**: when `dispatchesDone === 14`, `dailyReset(false)` is called automatically — queue reloads from SQLite without requiring manual `!reset`; confirmation message sent to bot's own number with loaded count

### Changed

- **`dailyReset()` now returns loaded count** _(scheduler.js)_
  - Return value used by `handleReset`, `initResetScheduler` cron, and `dispatcher.js` post-cycle handler to compose confirmation messages
- **`checkMissedDispatches` upper bound added** _(scheduler.js)_
  - Watchdog now exits early if `current >= "22:00"` — prevents firing overdue slots outside the dispatch window
- **`handleReset` rewritten** _(commands.js)_
  - Delegates entirely to `dailyReset(reschedule)` which now includes auto-feed internally
  - Reply message reports loaded count from return value
  - Duplicate `require('./scheduler')` inside function body removed
- **`resolveGroups` deduplicates via `Set`** _(neighborhood.js)_
  - `[...new Set([...GENERAL_GROUPS, ...eligible])]` prevents duplicate group IDs when a specific group appears in both general and specific lists
- **`dispatcher.js` uses `shuffle` and `microVary` from `helpers.js`**
  - Group send order randomized per dispatch via `shuffle(message.targetGroups || GENERAL_GROUPS)`
  - Each message body varied with `microVary()` before sending

### Fixed

- **`initResetScheduler` cron had `loaded` undefined** _(scheduler.js)_
  - `dailyReset()` now returns the loaded count; captured as `const loaded = await dailyReset()` inside the cron callback
- **Stale patch comments removed from `commands.js`**
  - Block comment with leftover patch instructions removed from source

---

### Adicionado

- **`auto-scheduler.js` — novo módulo para auto-alimentação da fila via SQLite**
  - `fetchAndReserveAnnouncements(limit)`: seleciona até 14 imóveis disponíveis (`ImovelStatus = 'Disponível'`) do banco externo `imoveis.db`, respeitando duas regras independentes:
    1. **Ciclo por instância** (`Dispatch_Cycle`): cada instância percorre todos os imóveis antes de repetir; ciclo reseta automaticamente via `DELETE + re-query` quando esgotado
    2. **Deduplicação diária entre instâncias** (`Dispatched_Today`): reserva atômica via `INSERT OR IGNORE` na PRIMARY KEY `(ImovelID, Reserved_At)` — nenhuma instância envia o mesmo imóvel no mesmo dia
  - `getAvailableForCycle(db, instance)`: consulta imóveis ainda não enviados neste ciclo; reseta ciclo automaticamente ao esgotar
  - `reserveForToday(db, ids, instance)`: `INSERT OR IGNORE` atômico em `Dispatched_Today`; retorna apenas IDs com `changes > 0`
  - `markAsSentInCycle(db, ids, instance)`: registra IDs enviados no `Dispatch_Cycle`
  - `pruneOldReservations()`: remove entradas antigas do `Dispatched_Today`; `Dispatch_Cycle` nunca é limpo externamente
  - Aplica formatação por instância: `mergeFormat` (account3), `mergeFormat2` (account1), raw (account2)
  - Constrói entradas da fila com resolução completa de bairro/classe/grupos
- **`helpers.js` — módulo utilitário anti-ban**
  - `sleep(ms)`: delay baseado em Promise
  - `shuffle(array)`: Fisher-Yates sem mutação do original via spread
  - `microVary(text)`: insere caractere Unicode invisível aleatório (`\u200B`, `\u200C`, `\u200D`, `\uFEFF`) em posição aleatória — torna o fingerprint de cada mensagem único para reduzir detecção de padrões pelo WhatsApp
  - `INVISIBLE_CHARS`: array constante exportado para referência/testes
- **`autoFeedQueue()` em `scheduler.js`**: orquestra `pruneOldReservations` + `fetchAndReserveAnnouncements(14)`; reindexar entradas; define `state.todayQueue`, zera `dispatchesDone`, chama `saveQueue()`; retorna o número de anúncios carregados; exportado para uso no boot do `client.js`
- **Auto-feed no boot em `client.js`**: se `todayQueue` estiver vazia após carregar do disco no evento `ready`, `autoFeedQueue()` é chamado automaticamente antes de `scheduleDispatches()`
- **Auto-reset pós-ciclo em `dispatcher.js`**: quando `dispatchesDone === 14`, `dailyReset(false)` é chamado automaticamente — fila recarrega do SQLite sem necessidade de `!reset` manual; mensagem de confirmação enviada para o próprio número do bot com o total carregado

### Alterado

- **`dailyReset()` agora retorna o número de anúncios carregados** _(scheduler.js)_
  - Valor de retorno usado por `handleReset`, pelo cron do `initResetScheduler` e pelo handler pós-ciclo do `dispatcher.js` para compor mensagens de confirmação
- **Upper bound adicionado ao `checkMissedDispatches`** _(scheduler.js)_
  - Watchdog agora sai cedo se `current >= "22:00"` — evita disparo de slots atrasados fora da janela de despacho
- **`handleReset` reescrito** _(commands.js)_
  - Delega inteiramente ao `dailyReset(reschedule)`, que agora inclui auto-feed internamente
  - Mensagem de reply reporta o total carregado via valor de retorno
  - `require('./scheduler')` duplicado dentro do corpo da função removido
- **`resolveGroups` deduplica via `Set`** _(neighborhood.js)_
  - `[...new Set([...GENERAL_GROUPS, ...eligible])]` previne IDs de grupos duplicados quando um grupo aparece nas listas geral e específica simultaneamente
- **`dispatcher.js` usa `shuffle` e `microVary` de `helpers.js`**
  - Ordem de envio por grupo randomizada a cada disparo via `shuffle(message.targetGroups || GENERAL_GROUPS)`
  - Corpo de cada mensagem variado com `microVary()` antes de enviar

### Corrigido

- **`loaded` indefinido no cron do `initResetScheduler`** _(scheduler.js)_
  - `dailyReset()` agora retorna o total carregado; capturado como `const loaded = await dailyReset()` dentro do callback do cron
- **Comentários de patch obsoletos removidos do `commands.js`**
  - Bloco de comentário com instruções de patch remanescentes removido do código-fonte

---

> **Commit:** `feat(auto-scheduler): SQLite-driven queue auto-feed with per-instance cycle and cross-instance dedup [v4.0.0]`  
> **Tag:** `v4.0.0`

---

## [3.6.3] - 2026-05-07

### Fixed

- **`scheduleDate` set one day ahead on any reset trigger** _(scheduler.js)_
  - Root cause: `dailyReset()` used `new Date(Date.now() + 24h)` to compute `scheduleDate`, resulting in tomorrow's date being stored regardless of when the reset was called.
  - Since all three reset paths (midnight cron, `!reset` command, post-14th-dispatch) go through the same `dailyReset()`, all were affected.
  - Consequence: `checkMissedDispatches` guards `state.scheduleDate !== todaySP` and returned immediately on every tick — the watchdog was silently disabled after any reset.
  - Fix: replaced `tomorrow` with `new Date()`. At midnight the date is already the new day; for manual and post-dispatch resets the current date is always correct.

- **Watchdog incorrectly flags new queue as overdue after late-day reset** _(scheduler.js)_
  - Root cause: when `dailyReset()` is triggered after the 14th dispatch (typically 22h–23h), a new queue is loaded with slots starting at 09:00. The watchdog, still active, detects all 14 slots as overdue and schedules them for immediate/delayed dispatch.
  - Fix: added an upper bound guard — `if (current >= "22:00") return` — alongside the existing `current < "09:00"` guard. The watchdog now operates only within the 09:00–22:00 dispatch window. Any overdue slot will have already been detected and scheduled before 22:00, so no recovery is lost.

---

### Corrigido

- **`scheduleDate` definido com um dia à frente em qualquer trigger de reset** _(scheduler.js)_
  - Causa raiz: `dailyReset()` usava `new Date(Date.now() + 24h)` para calcular `scheduleDate`, resultando na data de amanhã sendo armazenada independente do momento do reset.
  - Como os três caminhos de reset (cron de meia-noite, comando `!reset`, pós-14º disparo) passam pelo mesmo `dailyReset()`, todos eram afetados.
  - Consequência: o guard `state.scheduleDate !== todaySP` do `checkMissedDispatches` retornava imediatamente em cada tick — o watchdog ficava silenciosamente desabilitado após qualquer reset.
  - Correção: substituído `tomorrow` por `new Date()`. À meia-noite a data já é o novo dia; para resets manuais e pós-disparo, a data corrente é sempre correta.

- **Watchdog capturava nova fila como atrasada após reset no fim do dia** _(scheduler.js)_
  - Causa raiz: quando `dailyReset()` é acionado após o 14º disparo (tipicamente entre 22h e 23h), uma nova fila é carregada com slots a partir das 09:00. O watchdog, ainda ativo, detectava todos os 14 slots como atrasados e os agendava para disparo imediato ou com delay.
  - Correção: adicionado guard de limite superior — `if (current >= "22:00") return` — junto ao guard existente `current < "09:00"`. O watchdog agora opera apenas dentro da janela de despacho 09:00–22:00. Qualquer slot atrasado já terá sido detectado e agendado antes das 22:00, sem perda de recuperação.

---

> **Commit:** `fix(scheduler): fix scheduleDate off-by-one in dailyReset, add 22:00 upper bound to watchdog`  
> **Tag:** `v3.6.3`

---

## [3.6.2] - 2026-04-27

### Fixed

- **Detached frame detection now uses generic match** _(dispatcher.js)_
  - Previous check used a hardcoded Chromium frame ID (`'1F87160AD4DB2804E122156AA154735E`), which is generated dynamically per session and never matched in practice — making the guard dead code.
  - Fix: replaced with a generic `includes("Attempted to use detached Frame")` match, ensuring `process.exit(1)` fires correctly on the first failed group instead of letting the loop continue through all remaining groups.

---

### Corrigido

- **Detecção de frame destacado agora usa match genérico** _(dispatcher.js)_
  - A verificação anterior usava um frame ID hardcoded do Chromium (`'1F87160AD4DB2804E122156AA154735E`), gerado dinamicamente por sessão e que nunca correspondia na prática — tornando o guard código morto.
  - Correção: substituído por `includes("Attempted to use detached Frame")` genérico, garantindo que o `process.exit(1)` dispare corretamente no primeiro grupo com falha, em vez de continuar o loop pelos grupos restantes.

---

> **Commit:** `fix(dispatcher): fix detached frame detection, replace hardcoded frame ID with generic match`  
> **Tag:** `v3.6.2`

---

## [3.6.1] - 2026-04-21

### Changed

- **`!reset --reschedule` replaces `!reset*`** _(client.js)_
  - Variant syntax changed from `!reset*` to `!reset --reschedule` for clarity and consistency with CLI conventions.
  - Routing order preserved: `!reset --reschedule` is checked before `!reset` to avoid the more specific pattern being swallowed by the generic one.
- **`handleReset` log now distinguishes reschedule mode** _(commands.js)_
  - Previously logged `"Bot reset manually"` regardless of the `reschedule` flag.
  - Now logs `"Bot reset manually with reschedule"` when `reschedule` is `true`, and `"Bot reset manually"` when `false`, improving audit trail granularity.
  - Reply message updated accordingly: `"🗑️ Manual reset with reschedule."` vs `"🗑️ Manual reset."`.

---

### Alterado

- **`!reset --reschedule` substitui `!reset*`** _(client.js)_
  - Sintaxe da variante alterada de `!reset*` para `!reset --reschedule` para maior clareza e consistência com convenções de CLI.
  - Ordem de roteamento preservada: `!reset --reschedule` é verificado antes de `!reset` para evitar que o padrão mais específico seja capturado pelo genérico.
- **Log do `handleReset` agora distingue o modo de reschedule** _(commands.js)_
  - Anteriormente logava `"Bot reset manually"` independente do flag `reschedule`.
  - Agora loga `"Bot reset manually with reschedule"` quando `reschedule` é `true`, e `"Bot reset manually"` quando `false`, melhorando a granularidade da trilha de auditoria.
  - Mensagem de reply atualizada de acordo: `"🗑️ Manual reset with reschedule."` vs `"🗑️ Manual reset."`.

---

> **Commit:** `fix(commands): replace !reset* with !reset --reschedule, split reset log by reschedule flag`  
> **Tag:** `v3.6.1`

---

## [3.6.0] - 2026-04-21

### Added

- **`handleReset` command (`!reset` / `!reset*`)** _(commands.js, client.js)_
  - `!reset` triggers a full `dailyReset(false)` — clears queue, counters, schedule and re-arms slot crons, without rescheduling the midnight reset cron.
  - `!reset*` triggers `dailyReset(true)` — same as above but also re-arms the midnight reset cron.
  - `reschedule` parameter is passed from `client.js` to `handleReset`, keeping the command handler decoupled from the reset lifecycle decision.
  - `handleReset` correctly uses `await dailyReset(reschedule)`, ensuring the reply is only sent after the reset completes.
  - `handleReset` exported from `commands.js` and imported in `client.js`.

### Fixed

- **`!reset*` was dead code due to incorrect routing order** _(client.js)_
  - `startsWith("!reset")` was evaluated before `startsWith("!reset*")`, making the latter unreachable. Order corrected: specific patterns now checked before generic ones.
- **`🛑` added to `botPrefixes`** _(client.js)_
  - Bot reply prefix list updated to include `🛑` to prevent self-triggered command loops from `handleStopMidnightReset` replies.
- **`handleStopMidnightReset` reply updated to `🛑`** _(commands.js)_
  - Reply emoji changed from `🗑️` to `🛑` to semantically distinguish a stop action from a clear/reset action, and to align with the updated `botPrefixes` guard.

---

### Adicionado

- **Comando `handleReset` (`!reset` / `!reset*`)** _(commands.js, client.js)_
  - `!reset` executa `dailyReset(false)` — limpa fila, contadores e schedule e reagenda os slot crons, sem rearmar o cron de meia-noite.
  - `!reset*` executa `dailyReset(true)` — igual ao anterior, mas também reativa o cron de meia-noite.
  - O parâmetro `reschedule` é passado do `client.js` para o `handleReset`, mantendo o handler desacoplado da decisão do ciclo de vida do reset.
  - `handleReset` usa corretamente `await dailyReset(reschedule)`, garantindo que o reply só seja enviado após o reset concluir.
  - `handleReset` exportado de `commands.js` e importado em `client.js`.

### Corrigido

- **`!reset*` era código morto por ordem incorreta no roteamento** _(client.js)_
  - `startsWith("!reset")` era avaliado antes de `startsWith("!reset*")`, tornando este último inalcançável. Ordem corrigida: padrões mais específicos agora são verificados antes dos genéricos.
- **`🛑` adicionado ao `botPrefixes`** _(client.js)_
  - Lista de prefixos de resposta do bot atualizada para incluir `🛑`, prevenindo loops de comando auto-acionados pelas respostas do `handleStopMidnightReset`.
- **Reply do `handleStopMidnightReset` atualizado para `🛑`** _(commands.js)_
  - Emoji do reply alterado de `🗑️` para `🛑` para distinguir semanticamente uma ação de parada de uma ação de limpeza/reset, e para alinhar com o guard de `botPrefixes` atualizado.

---

> **Commit:** `feat(commands): add !reset and !reset* commands, fix routing order, update botPrefixes`  
> **Tag:** `v3.6.0`

---

## [3.5.1] - 2026-04-21

### Fixed

- **`"sending"` slots no longer get stuck after bot crash or power loss** _(persistence.js, dispatcher.js, state.js)_
  - Root cause: when the bot was killed mid-dispatch, the slot status remained `"sending"` on disk. On reboot, `checkMissedDispatches` skipped those slots (status ≠ `"waiting"`), leaving them permanently stuck and causing PM2 instability.
  - Fix: `recoverSendingSlots()` added to `persistence.js`. Must be called in `client.js` after `loadQueue()` on boot. It resets any `"sending"` slot back to `"waiting"` and logs which slots were recovered.
  - `dispatcher.js` now persists `result: { successes, failures }` to disk after **each individual group send**, not only at the end of the slot. This provides a mid-slot progress snapshot on disk if the bot crashes partway through.
  - `dispatcher.js` now stamps `dispatchStartedAt` on the queue entry when a slot begins, improving crash forensics.
  - `state.js`: added `bootRecoveredAt` field to record the timestamp of the last boot recovery, surfaceable via `!status`.

---

### Corrigido

- **Slots `"sending"` não ficam mais presos após queda do bot ou falta de luz** _(persistence.js, dispatcher.js, state.js)_
  - Causa raiz: quando o bot era encerrado no meio de um disparo, o status do slot permanecia `"sending"` em disco. No reboot, o `checkMissedDispatches` ignorava esses slots (status ≠ `"waiting"`), deixando-os presos permanentemente e causando instabilidade no PM2.
  - Correção: `recoverSendingSlots()` adicionada ao `persistence.js`. Deve ser chamada no `client.js` após `loadQueue()` no boot. Reverte qualquer slot `"sending"` para `"waiting"` e loga quais foram recuperados.
  - `dispatcher.js` agora persiste `result: { successes, failures }` em disco após **cada grupo enviado individualmente**, não apenas ao fim do slot. Isso fornece um snapshot de progresso parcial em disco caso o bot caia no meio de um slot.
  - `dispatcher.js` agora grava `dispatchStartedAt` na entrada da fila quando um slot começa, melhorando a rastreabilidade em caso de crash.
  - `state.js`: adicionado campo `bootRecoveredAt` para registrar o timestamp do último recovery de boot, exposto via `!status`.

---

> **Commit:** `fix(persistence): recover "sending" slots on boot, add incremental dispatch progress`  
> **Tag:** `v3.5.1`

---

## [3.5.0] - 2026-04-21

### Added

- **`handleStopMidnightReset`: manual stop command for the midnight reset cron** _(scheduler.js)_
  - Allows the operator to cancel the scheduled midnight reset on demand.
  - Destroys the active `resetCronTask`, sets it to `null`, clears `resetCronInitialized`, and sends a confirmation reply to the user.
  - Action is logged via `persistence.log("COMMAND", ...)` for audit trail.

---

### Adicionado

- **`handleStopMidnightReset`: comando para parar manualmente o cron de reset de meia-noite** _(scheduler.js)_
  - Permite que o operador cancele o reset agendado de meia-noite sob demanda.
  - Destrói o `resetCronTask` ativo, define como `null`, limpa `resetCronInitialized` e envia confirmação ao usuário.
  - Ação é registrada via `persistence.log("COMMAND", ...)` para rastreabilidade.

---

> **Commit:** `feat(scheduler): add handleStopMidnightReset command`  
> **Tag:** `v3.5.0`

---

## [3.4.1] - 2026-04-21

### Changed

- **`checkMissedDispatches`: overdue slots now fire with a random delay of 20–40 minutes** _(scheduler.js)_
  - Instead of firing immediately, each overdue slot is scheduled via `setTimeout` with a random delay between 20 and 40 minutes.
  - Before firing, the slot status is re-checked to ensure it is still `"waiting"`, preventing duplicate dispatches if another process already handled it during the delay window.
  - Log updated to include the randomly chosen delay in minutes.

---

### Alterado

- **`checkMissedDispatches`: slots atrasados agora disparam com delay aleatório de 20–40 minutos** _(scheduler.js)_
  - Em vez de disparar imediatamente, cada slot atrasado é agendado via `setTimeout` com delay aleatório entre 20 e 40 minutos.
  - Antes de disparar, o status do slot é reverificado para garantir que ainda está `"waiting"`, prevenindo disparos duplicados caso outro processo já tenha processado o slot durante o período de espera.
  - Log atualizado para incluir o delay sorteado em minutos.

---

> **Commit:** `fix(scheduler): add random 20–40min delay on missed dispatches`  
> **Tag:** `v3.4.1`

---

## [3.4.0] - 2026-04-12

### Changed

- **Dispatch slots expanded from 10 to 14** _(scheduler.js, dispatcher.js, commands.js, client.js)_
  - Schedule now covers 09:00–22:00 with 14 slots (previously 09:00–18:00 with 10).
  - `generateSchedule` updated with 4 new base slots: 19:00, 20:00, 21:00, 22:00.
  - `dispatcher.js`: `dailyReset` now triggers at `dispatchesDone === 14`.
  - `commands.js`: queue cap, status display, and fire validation updated to 14.
  - `client.js`: queue full message updated to 14.

- **Daily reset moved from 20:00 to 00:00** _(scheduler.js)_
  - Reset cron updated from `"0 20 * * *"` to `"0 0 * * *"` to accommodate the extended dispatch window that now runs until 22:45.
  - Watchdog operational window extended to `current >= "24:00"` (effectively disabled upper bound within a calendar day).

### Fixed

- **`parseInt` base error in `handleFire`** _(commands.js)_
  - `parseInt(parts[1], 14)` was using base 14 instead of base 10. While digits 0–9 parse identically, values like `"10"` would return `14` in decimal, causing `!fire 10` through `!fire 14` to silently resolve to wrong slot indices.
  - Fix: corrected to `parseInt(parts[1], 10)`.

- **Daily reset notification never sent** _(scheduler.js)_
  - `dailyReset` referenced `client` directly, which is not in scope in `scheduler.js`. The `ReferenceError` was silently swallowed by `catch {}`, so the confirmation message was never delivered.
  - Fix: corrected to `state.client`.

---

### Alterado

- **Slots de disparo expandidos de 10 para 14** _(scheduler.js, dispatcher.js, commands.js, client.js)_
  - Schedule agora cobre 09:00–22:00 com 14 slots (anteriormente 09:00–18:00 com 10).
  - `generateSchedule` atualizado com 4 novos slots base: 19:00, 20:00, 21:00, 22:00.
  - `dispatcher.js`: `dailyReset` agora dispara em `dispatchesDone === 14`.
  - `commands.js`: limite de fila, exibição de status e validação do fire atualizados para 14.
  - `client.js`: mensagem de fila cheia atualizada para 14.

- **Reset diário movido das 20:00 para 00:00** _(scheduler.js)_
  - Cron de reset atualizado de `"0 20 * * *"` para `"0 0 * * *"` para acomodar a janela de disparos estendida que agora vai até 22:45.
  - Janela operacional do watchdog estendida para `current >= "24:00"`.

### Corrigido

- **Erro de base no `parseInt` do `handleFire`** _(commands.js)_
  - `parseInt(parts[1], 14)` usava base 14 em vez de base 10. Para valores como `"10"`, retornaria `14` em decimal, fazendo `!fire 10` a `!fire 14` resolverem índices errados silenciosamente.
  - Correção: corrigido para `parseInt(parts[1], 10)`.

- **Notificação do reset diário nunca enviada** _(scheduler.js)_
  - `dailyReset` referenciava `client` diretamente, que não existe no escopo de `scheduler.js`. O `ReferenceError` era engolido silenciosamente pelo `catch {}`, e a mensagem de confirmação nunca era entregue.
  - Correção: corrigido para `state.client`.

---

> **Commit:** `feat(scheduler): expand to 14 slots (09–22h), fix reset cron, fix client ref in dailyReset, fix parseInt base`  
> **Tag:** `v3.4.0`

---

## [3.3.3] - 2026-04-10

### Fixed

- **Boot-time missed slot recovery fires outside operational window** _(client.js)_
  - On `client ready`, the bot iterated over past schedule slots and immediately dispatched any `waiting` message. This logic had no time-window guard, so restarting the bot between 20:00 and 23:59 with a next-day queue already loaded caused all slots to fire at once.
  - Root cause: the watchdog (`checkMissedDispatches`) correctly guards with `current >= "19:00"`, but the equivalent boot-time recovery block in `client.js` had no such guard.
  - Fix: the boot-time recovery block is now wrapped in `if (current >= "09:00" && current < "20:00")`, making it consistent with the watchdog's operational window.

---

### Corrigido

- **Recovery de slots perdidos no boot dispara fora da janela operacional** _(client.js)_
  - No evento `client ready`, o bot iterava sobre slots passados do schedule e despachava imediatamente qualquer mensagem `waiting`. Esse bloco não tinha guard de janela de tempo, então reiniciar o bot entre 20:00 e 23:59 com a fila do dia seguinte já carregada disparava todos os slots de uma vez.
  - Causa raiz: o watchdog (`checkMissedDispatches`) já protegia corretamente com `current >= "20:00"`, mas o bloco equivalente de recovery no boot em `client.js` não tinha essa guard.
  - Correção: o bloco de recovery no boot agora é envolvido em `if (current >= "09:00" && current < "20:00")`, tornando-o consistente com a janela operacional do watchdog.

---

> **Commit:** `fix(client): guard boot-time missed slot recovery to operational window (09:00–19:00)`  
> **Tag:** `v3.3.3`

---

## [3.3.2] - 2026-04-10

### Fixed

- **`state.scheduleDate` not set on boot when generating a new schedule** _(client.js)_
  - When no saved schedule existed on disk, the `else` branch generated a new schedule but never assigned `state.scheduleDate`. This left the field as `null`, causing the watchdog date-gate to always fail (`null !== todaySP`) and allowing all slots to fire immediately on the next queue load.
  - Fix: `state.scheduleDate` is now set to today's date in `America/Sao_Paulo` in the `else` branch, immediately after `generateSchedule()`.

- **`state.scheduleDate` not updated after `dailyReset`** _(scheduler.js)_
  - `dailyReset` generated a new schedule but did not update `state.scheduleDate`, leaving it stale from the previous day. On the next watchdog tick, the date-gate compared the old date against today and blocked all recovery — or, in edge cases, allowed unintended dispatches.
  - Fix: `state.scheduleDate` is now assigned the new day's date immediately after `generateSchedule()` inside `dailyReset`.

- **Watchdog date-gate did not guard against `null` schedule date** _(scheduler.js)_
  - The condition `state.scheduleDate !== todaySP` evaluated to `true` when `scheduleDate` was `null`, but the log message implied it was a date mismatch rather than an uninitialized state, making the root cause harder to diagnose.
  - Fix: guard updated to `!state.scheduleDate || state.scheduleDate !== todaySP`, making the null case explicit.

---

### Corrigido

- **`state.scheduleDate` não era definido no boot ao gerar um novo schedule** _(client.js)_
  - Quando nenhum schedule salvo existia em disco, o bloco `else` gerava um novo schedule mas nunca atribuía `state.scheduleDate`. O campo ficava como `null`, fazendo o gate de data do watchdog sempre falhar (`null !== todaySP`) e permitindo que todos os slots disparassem imediatamente na próxima carga de fila.
  - Correção: `state.scheduleDate` agora recebe a data de hoje em `America/Sao_Paulo` no bloco `else`, imediatamente após `generateSchedule()`.

- **`state.scheduleDate` não era atualizado após `dailyReset`** _(scheduler.js)_
  - `dailyReset` gerava um novo schedule mas não atualizava `state.scheduleDate`, deixando o valor obsoleto do dia anterior. No próximo tick do watchdog, o gate comparava a data antiga com a de hoje e bloqueava toda recuperação — ou, em casos extremos, permitia disparos indevidos.
  - Correção: `state.scheduleDate` agora recebe a data do novo dia imediatamente após `generateSchedule()` dentro de `dailyReset`.

- **Gate de data do watchdog não protegia contra schedule date `null`** _(scheduler.js)_
  - A condição `state.scheduleDate !== todaySP` era `true` quando `scheduleDate` era `null`, mas a mensagem de log indicava divergência de data em vez de estado não inicializado, dificultando o diagnóstico da causa raiz.
  - Correção: guard atualizado para `!state.scheduleDate || state.scheduleDate !== todaySP`, tornando o caso nulo explícito.

---

> **Commit:** `fix(scheduler): set scheduleDate on boot and after dailyReset, guard null in watchdog date-gate`  
> **Tag:** `v3.3.2`

---

## [3.3.1] - 2026-04-10

### Fixed

- **Missed slot recovery no longer fires future-day queue on bot restart** _(client.js, persistence.js, state.js)_
  - After a full 10-dispatch day, the operator may load the next day's queue before midnight. On restart, the bot was treating all schedule slots as overdue and dispatching them immediately.
  - Root cause: the schedule date was not persisted — on boot the bot had no way to know the schedule was generated for a future date.
  - Fix: `saveSchedule` now persists `{ date, slots }` instead of a bare array. `loadSchedule` returns both fields. `state.scheduleDate` holds the target date.
  - On boot, missed slot recovery is skipped entirely if `state.scheduleDate` does not match today's date in `America/Sao_Paulo`.

### Added

- `state.scheduleDate` — stores the date (`YYYY-MM-DD`) for which the current schedule was generated. _(state.js)_

---

### Corrigido

- **Recovery de slots perdidos não mais dispara fila do dia seguinte ao reiniciar o bot** _(client.js, persistence.js, state.js)_
  - Após completar os 10 disparos do dia, o operador pode carregar a fila do dia seguinte antes da meia-noite. Ao reiniciar, o bot tratava todos os slots do schedule como atrasados e os disparava imediatamente.
  - Causa raiz: a data do schedule não era persistida — no boot o bot não tinha como saber que o schedule foi gerado para uma data futura.
  - Correção: `saveSchedule` agora persiste `{ date, slots }` em vez de um array puro. `loadSchedule` retorna ambos os campos. `state.scheduleDate` armazena a data alvo.
  - No boot, o recovery de slots perdidos é ignorado completamente se `state.scheduleDate` não corresponder à data de hoje em `America/Sao_Paulo`.

### Adicionado

- `state.scheduleDate` — armazena a data (`YYYY-MM-DD`) para a qual o schedule atual foi gerado. _(state.js)_

---

> **Commit:** `fix(scheduler): persist schedule date to prevent future-day queue from firing on restart`  
> **Tag:** `v3.3.1`

---

## [3.3.0] - 2026-04-10

### Changed

- **Daily reset scheduling migrated from post-19h cron to fixed 03:00 cron** _(scheduler.js)_
  - Previous approach scheduled reset via cron triggered after 19:00 (end of dispatch window), which depended on the counter reaching 10 to cancel it or let it fire.
  - New approach: reset is always anchored at 03:00 AM, outside any operational window, eliminating the risk of an accidental mid-day trigger.

- **`dailyReset` is now the single source of truth for the reset cron lifecycle** _(scheduler.js)_
  - `dailyReset` now destroys the active `resetCronTask`, clears `resetCronInitialized`, runs all state cleanup, and calls `initResetScheduler()` at the end to re-arm for the next day.
  - Whether triggered by the 10th dispatch or by the 03:00 cron itself, the behavior is identical and fully self-contained.

- **`dispatcher.js` decoupled from reset cron lifecycle** _(dispatcher.js)_
  - Removed `initResetScheduler` import and all cron management logic from `executeDispatch`.
  - The dispatcher now only calls `dailyReset()` when `dispatchesDone === 10` and delegates all lifecycle responsibility to it.

- **Removed redundant watchdog cron guard in `client.js`** _(client.js)_
  - The `if (!state.resetCronInitialized)` guard around the `checkMissedDispatches` cron was based on the old reset flag semantics and had no effect. The watchdog cron is now registered unconditionally on `ready`.

### Removed

- `state.resetFiredAt` — no longer needed after moving away from the `setTimeout`-based reset scheduler introduced in v3.1.0. _(state.js)_

---

### Alterado

- **Agendamento do reset diário migrado de cron pós-19h para cron fixo às 03:00** _(scheduler.js)_
  - A abordagem anterior agendava o reset via cron disparado após as 19:00 (fim da janela de disparos), dependendo do contador chegar a 10 para cancelá-lo ou deixá-lo executar.
  - Nova abordagem: reset sempre fixado às 03:00, fora de qualquer janela operacional, eliminando risco de disparo acidental durante o dia.

- **`dailyReset` passa a ser a única fonte de verdade do ciclo de vida do cron de reset** _(scheduler.js)_
  - `dailyReset` agora destrói o `resetCronTask` ativo, limpa `resetCronInitialized`, executa toda a limpeza de estado e chama `initResetScheduler()` ao final para rearmar o cron para o dia seguinte.
  - Seja acionado pelo 10º disparo ou pelo próprio cron das 03:00, o comportamento é idêntico e completamente autocontido.

- **`dispatcher.js` desacoplado do ciclo de vida do cron de reset** _(dispatcher.js)_
  - Removidos import de `initResetScheduler` e toda a lógica de gerenciamento de cron de `executeDispatch`.
  - O dispatcher agora apenas chama `dailyReset()` quando `dispatchesDone === 10` e delega toda a responsabilidade de ciclo de vida para ela.

- **Removido guard redundante do cron watchdog em `client.js`** _(client.js)_
  - O guard `if (!state.resetCronInitialized)` em volta do cron `checkMissedDispatches` estava baseado na semântica antiga da flag de reset e não tinha efeito. O cron watchdog agora é registrado incondicionalmente no evento `ready`.

### Removido

- `state.resetFiredAt` — não é mais necessário após a remoção do scheduler baseado em `setTimeout` introduzido na v3.1.0. _(state.js)_

---

> **Commit:** `refactor(reset): anchor daily reset to 03:00 cron, make dailyReset sole lifecycle owner`  
> **Tag:** `v3.3.0`

---

## [3.2.0] - 2026-04-06

### Fixed

- **Watchdog: eliminated duplicate scheduling of overdue slots** _(scheduler.js, state.js)_
  - Added `state.watchdogScheduled` (`Set`) to track slots already enqueued by the watchdog.
  - Each slot is now registered in the Set before any async operation, preventing re-scheduling on subsequent `checkMissedDispatches` ticks.
  - The Set is cleared on daily reset (`dailyReset`).

- **Watchdog: first overdue slot of the day now fires immediately** _(scheduler.js)_
  - The first missed slot detected each day is dispatched without delay.
  - Subsequent overdue slots retain the 20–30 min random delay.

- **Watchdog: sequential dispatch — next overdue slot only fires after previous is complete** _(scheduler.js)_
  - Before scheduling a slot, the watchdog now checks that the immediately preceding slot has a terminal status (`sent` or `error`).
  - If the previous slot is still `waiting` or `sending`, the current slot is deferred to the next watchdog tick (≤60s), avoiding queue saturation.

### Added

- `state.watchdogScheduled` — `Set<number>` tracking slot indices already handled by the watchdog. _(state.js)_

### Corrigido

- **Watchdog: eliminado reagendamento duplicado de slots atrasados**
  - Adicionado `state.watchdogScheduled` (`Set`) para rastrear slots já enfileirados pelo watchdog.
  - Cada slot é registrado no Set antes de qualquer operação assíncrona, impedindo reagendamento em ticks subsequentes do `checkMissedDispatches`.
  - O Set é limpo no reset diário (`dailyReset`).

- **Watchdog: primeiro slot atrasado do dia disparado imediatamente**
  - O primeiro slot perdido detectado a cada dia é despachado sem atraso.
  - Os demais slots atrasados mantêm o atraso aleatório de 20–30 min.

- **Watchdog: disparo sequencial — próximo slot atrasado só é agendado após conclusão do anterior**
  - Antes de agendar um slot, o watchdog verifica se o slot imediatamente anterior possui status terminal (`sent` ou `error`).
  - Se o slot anterior ainda estiver `waiting` ou `sending`, o slot atual é adiado para o próximo tick do watchdog (≤60s), evitando saturação da fila.

### Adicionado

- `state.watchdogScheduled` — `Set<number>` com índices de slots já tratados pelo watchdog. _(state.js)_

---

> **Commit:** `fix(watchdog): prevent duplicate scheduling, add sequential guard and immediate first-miss dispatch`  
> **Tag:** `v3.2.0`

---

## [3.1.1] - 2026-04-04

### Changed

- **Improved watchdog recovery for missed dispatches** _(scheduler.js)_
  - Increased jitter range from 0–29 minutes to 0–45 minutes for better distribution.
  - Changed immediate firing to delayed retry (20–40 min random) to prevent queue saturation.
  - Added pre-dispatch validation to ensure message is still pending before execution.

### Alterado

- **Melhoria na recuperação de slots perdidos (watchdog)**
  - Aumento do jitter de 0–29 para 0–45 minutos para melhor distribuição.
  - Mudança de disparo imediato para tentativa com atraso (20–40 min aleatório) para evitar saturação.
  - Validação pré-disparo para garantir que a mensagem ainda esteja pendente antes da execução.

---

## [3.1.0] - 2026-04-03

### Changed

- **Daily Reset scheduling refactor (`node-cron` → recursive `setTimeout`)** _(scheduler.js, client.js, state.js)_
  - Replaced cron-based scheduling with `initResetScheduler()` + `scheduleNextReset()`.
  - Root cause: CPU saturation (Puppeteer/Chromium) caused missed cron ticks.
  - Dynamic calculation (`msUntilSP`) ensures execution even under drift.
  - Added double-safeguard against early execution.
  - Prevents duplicate execution via `state.resetFiredAt`.
  - Guarantees single scheduler instance.
  - Watchdog recovers missed dispatches (≤60s).

### Alterado

- **Refatoração do agendamento do reset diário (`node-cron` → `setTimeout` recursivo)**
  - Substituição do cron por scheduler manual resiliente.
  - Causa raiz: saturação de CPU gerando falhas silenciosas.
  - Cálculo dinâmico garante execução mesmo com atraso.
  - Proteção contra execução antecipada.
  - Prevenção de duplicidade via estado.
  - Garantia de instância única do scheduler.
  - Watchdog mantém recuperação automática.

### Added

- `state.resetSchedulerInitialized`
- `state.resetTimer`
- `state.resetFiredAt`
- `initResetScheduler()`

### Adicionado

- Flag de inicialização única
- Referência de timer ativo
- Controle de execução duplicada
- Inicializador do scheduler

---

## [3.0.4] - 2026-03-31

### Fixed

- Prevented event loop blocking by replacing sync file writes with async operations.

### Corrigido

- Evitado bloqueio do event loop ao substituir escrita síncrona por assíncrona.

---

## [3.0.3] - 2026-03-30

### Fixed

- Prevented cron duplication
- Fixed dispatch deadlock
- Added watchdog recovery
- Improved timezone handling

### Corrigido

- Evitada duplicação de cron
- Corrigido travamento de fila
- Adicionado watchdog de recuperação
- Melhor tratamento de timezone

---

## [3.0.2] - 2026-03-30

### Changed

- Standardized root data directory resolution

### Alterado

- Padronização do diretório raiz de dados

---

## [3.0.1] - 2026-03-30

### Fixed

- Corrected DATA_DIR path resolution
- Fixed overnight queue discard bug

### Corrigido

- Correção de path de dados
- Correção de descarte indevido de fila

---

## [3.0.0] - 2026-03-28

### Changed (Breaking)

- Modular architecture
- New entry point
- Centralized state

### Alterado (Breaking)

- Arquitetura modular
- Novo ponto de entrada
- Estado centralizado

---

## [2.1.2] - 2026-03-28

### Fixed

- Fixed dispatch race condition

### Corrigido

- Correção de condição de corrida

---

## [2.1.1] - 2026-03-27

### Fixed

- Persistent scheduling bug fixed

### Corrigido

- Correção de agendamento persistente

---

## [2.1.0] - 2026-03-26

### Added

- Catch-up mechanism

### Adicionado

- Mecanismo de recuperação

### Fixed

- Timezone issues

### Corrigido

- Problemas de timezone

---

## [2.0.1] - 2026-03-25

### Fixed

- Preview extraction logic improved

### Corrigido

- Extração de preview melhorada

---

## [2.0.0] - 2026-03-25

### Changed

- Codebase migrated to English

### Alterado

- Código migrado para inglês

### Added

- New commands and queue system

### Adicionado

- Novos comandos e sistema de fila

### Fixed

- Async I/O and duplication issues

### Corrigido

- Problemas de I/O e duplicidade

---

## [1.0.0] - 2026-03-20

### Added

- Initial bot implementation

### Adicionado

- Implementação inicial do bot
