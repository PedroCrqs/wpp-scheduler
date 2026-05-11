# Changelog

All notable changes to this project will be documented in this file.  
Todas as alterações relevantes deste projeto serão documentadas neste arquivo.

Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Baseado em [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [4.0.2] - 2026-05-11

### Fixed

### Fixed

- **`autoFeedQueue` was altering the database but not backing it up to the drive. When making changes to the .db remotely, all control over the firing order was lost.** _(auto-scheduler.js)_

- Without backing up, all control over the firing order was lost.

- **The function `doBackup(direction)` aligns with the database backup flow so that remote work is possible.** _(client.js)_

- `doBackup("download")` downloads the changes made remotely.

- `doBackup("upload")` saves the changes made locally to the remote drive.

---

### Corrigido

- **`autoFeedQueue` alterava a database mas não fazia o backup para o drive. Ao fazer alterações na .db remotamente, todo o controle de disparos era perdido** _(auto-scheduler.js)_
  - sem fazer backupt, todo o controle sobre a ordem de disparos era perdido

- **Função `doBackup(direction)` se alinha ao fluxo de backup da database para que o trabalho remoto seja possível** _(client.js)_
  - `doBackup("donwload")` baixa as alterações feitas remotamente.
  - `doBackup("upload")` salva as alterações feitas localmente no drive remoto.

---

> **Commit:** `fix(auto-scheduler, scheduler): database backup system added [v4.0.2]`
> **Tag:** `v4.0.2`

---

## [4.0.1] - 2026-05-07

### Fixed

- **`startBot` declared twice in `client.js`** _(client.js)_
  - The function body was duplicated verbatim. Only the first declaration is reachable; the second was dead code and a maintenance hazard.
  - Fix: duplicate removed.

- **`setTimeout(startBot(), 30000)` immediately invokes `startBot` instead of scheduling it** _(client.js)_
  - `startBot()` (with parentheses) executes the function and passes its return value (`undefined`) to `setTimeout`, so the retry fires at once rather than after 30 seconds — and a second call site in `auth_failure` had the same bug.
  - Fix: both changed to `setTimeout(startBot, 30000)` (function reference).

- **`recoverSendingSlots()` called after the empty-queue auto-feed guard** _(client.js)_
  - On boot, slots stuck in `"sending"` were converted to `"waiting"` only after the `todayQueue.length === 0` check, meaning a queue with all entries in `"sending"` would incorrectly trigger an auto-feed from the database before recovery ran.
  - Fix: `recoverSendingSlots()` is now called before the auto-feed guard so the queue length reflects the true post-recovery state.

- **`err` used in `catch {}` block with no parameter in post-cycle reset** _(dispatcher.js)_
  - After the 14th dispatch, `dailyReset(false)` was wrapped in a `try` and a separate `catch {}` used `err.message` in a `log()` call — but `err` was never declared in that scope, causing a `ReferenceError` at runtime.
  - Fix: the reset and the notification are each wrapped in their own `try/catch` blocks with properly named parameters (`resetErr`, `msgErr`).

---

### Corrigido

- **`startBot` declarada duas vezes em `client.js`** _(client.js)_
  - O corpo da função foi duplicado literalmente. Apenas a primeira declaração é acessível; a segunda era código morto e um risco de manutenção.
  - Correção: duplicata removida.

- **`setTimeout(startBot(), 30000)` invoca `startBot` imediatamente em vez de agendar** _(client.js)_
  - `startBot()` (com parênteses) executa a função e passa seu valor de retorno (`undefined`) ao `setTimeout`, fazendo o retry disparar imediatamente — e um segundo ponto de chamada em `auth_failure` tinha o mesmo bug.
  - Correção: ambos alterados para `setTimeout(startBot, 30000)` (referência à função).

- **`recoverSendingSlots()` chamado após o guard de fila vazia para auto-feed** _(client.js)_
  - No boot, slots presos em `"sending"` eram convertidos para `"waiting"` somente após o check `todayQueue.length === 0`, fazendo uma fila com todas as entradas em `"sending"` disparar incorretamente um auto-feed do banco antes da recuperação ocorrer.
  - Correção: `recoverSendingSlots()` agora é chamado antes do guard de auto-feed, para que o tamanho da fila reflita o estado real pós-recuperação.

- **`err` usado em bloco `catch {}` sem parâmetro no reset pós-ciclo** _(dispatcher.js)_
  - Após o 14º disparo, `dailyReset(false)` era encapsulado em um `try` e um `catch {}` separado usava `err.message` numa chamada de `log()` — mas `err` nunca era declarado naquele escopo, causando `ReferenceError` em runtime.
  - Correção: o reset e a notificação são encapsulados em blocos `try/catch` próprios com parâmetros devidamente nomeados (`resetErr`, `msgErr`).

---

> **Commit:** `fix(client,dispatcher): remove duplicate startBot, fix setTimeout reference, fix recoverSendingSlots order, fix undefined err in post-reset catch [v4.0.1]`  
> **Tag:** `v4.0.1`

---

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

## [3.6.2] - 2026-04-28

### Fixed

- **Dispatch now exits on unrecoverable network errors** _(dispatcher.js)_
  - `net::ERR_NETWORK_CHANGED` and `net::ERR_NAME_NOT_RESOLVED` were previously swallowed as regular failures, letting the loop continue through all remaining groups with guaranteed errors.
  - Fix: both errors now trigger `process.exit(1)` immediately, delegating recovery to PM2.

---

### Corrigido

- **Dispatch agora encerra em erros de rede irrecuperáveis** _(dispatcher.js)_
  - `net::ERR_NETWORK_CHANGED` e `net::ERR_NAME_NOT_RESOLVED` eram tratados como falhas comuns, permitindo que o loop continuasse pelos grupos restantes com erros garantidos.
  - Correção: ambos os erros agora disparam `process.exit(1)` imediatamente, delegando a recuperação ao PM2.

---

> **Commit:** `fix(dispatcher): exit on network errors (ERR_NETWORK_CHANGED, ERR_NAME_NOT_RESOLVED)`  
> **Tag:** `v3.6.2`

---

## [3.6.1] - 2026-04-27

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
> **Tag:** `v3.6.1`
