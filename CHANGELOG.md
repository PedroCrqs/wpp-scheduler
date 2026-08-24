# Changelog

All notable changes to this project will be documented in this file.  
Todas as alterações relevantes deste projeto serão documentadas neste arquivo.

Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Baseado em [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [5.0.0] - 2026-07-19

### Changed

- **Migrated database layer from SQLite to PostgreSQL** _(auto-scheduler.js, scheduler.js, db.js)_
  - Context: the underlying `imoveis-database` was migrated from a local SQLite file to a PostgreSQL server shared live by the CLI, the website, and this bot's concurrent instances (`account1/2/3`).
  - `src/db.js` (new): shared `pg.Pool` reading `DATABASE_URL` from the environment.
  - `auto-scheduler.js` rewritten: `node:sqlite` direct file access replaced with parameterized `pg` queries. Row access adjusted for Postgres' lowercase-folded unquoted identifiers (`row.ImovelID` → `row.imovelid`).

### Removed

- **File-based distributed lock and Drive `.db` sync** _(auto-scheduler.js, scheduler.js)_
  - Root cause it existed for: SQLite can't handle concurrent multi-process writes safely, so the 3 bot instances previously coordinated via `acquireLock()`/`releaseLock()` (a lock file on Google Drive) plus `doBackup("download"/"upload")` copying the entire `.db` before/after every reservation cycle — expensive, and prone to leaving a stuck lock if an instance died mid-run (hence the old `LOCK_TIMEOUT_MS` safety net).
  - With Postgres this entire mechanism is unnecessary: `fetchAndReserveAnnouncements` now reserves properties inside a single transaction using `INSERT ... ON CONFLICT (ImovelID, Reserved_At) DO NOTHING RETURNING ImovelID` — atomic at the database level. Two instances racing for the same property simply can't both succeed; no file lock, no Drive round-trip.
  - Verified with a concurrency test: 3 simulated instances calling `fetchAndReserveAnnouncements` simultaneously against a real Postgres — zero duplicate reservations, no lock of any kind involved.
  - `scheduler.js`'s `autoFeedQueue()` simplified accordingly: no longer wraps the cycle in `acquireLock`/`doBackup`/`releaseLock`.

### Added

- **`pg` dependency** _(package.json)_ — `^8.13.0`, node-postgres client.
- **Dockerfile** (new) — initially based on `ghcr.io/puppeteer/puppeteer:23.9.0`, later rewritten to `node:18-slim` + Chromium installed via `apt-get` with `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`/`PUPPETEER_EXECUTABLE_PATH` (see "Fixed" below for why). Runs as the image's non-root `pptruser`. Instance (`account1/2/3`) is selected via `command:` in `docker-compose.yml`, not baked into the image.

### Fixed

- **`reserveForToday` partial-insert race condition preserved, not reintroduced** _(auto-scheduler.js)_
  - The original "complement" retry logic (if fewer slots than requested got reserved, top up from the remaining candidates) was ported over using `INSERT ... RETURNING` instead of manual pre/post row counting — same intent, now backed by an atomic operation instead of a read-then-write gap.
- **`Could not find Chrome` at runtime, caused by `npm ci` running as root** _(Dockerfile)_
  - Root cause: `npm ci` ran under `USER root` (to allow `chown`), so Puppeteer's postinstall downloaded Chrome into `/root/.cache/puppeteer` — but the container runs as `pptruser` at runtime, which looks for it in `/home/pptruser/.cache/puppeteer`. Two different locations, so the browser was never found.
  - Fix: switched to `USER pptruser` before `npm ci`, so the download lands in the same cache directory the app looks up at runtime. `COPY --chown=pptruser:pptruser` replaces the separate `chown -R pptruser:pptruser /app` step, which also cut a ~129s recursive chown out of the build.
- **`webVersionCache` nested inside `LocalAuth`, silently ignored by `whatsapp-web.js`** _(client.js)_
  - Root cause: `webVersion` and `webVersionCache` were nested inside the `authStrategy: new LocalAuth({...})` options object instead of at the root of the `Client` options — `whatsapp-web.js` reads these two keys from the top-level `Client` config, not from `LocalAuth`, so they were silently ignored.
  - Fix: moved `webVersionCache` (and `webVersion`) to the root level of the `Client` options object, alongside `authStrategy`.
- **Instance froze at "Syncing..." after reading the QR code, `ready` event never fired** _(client.js)_
  - Root cause: combined with the nesting bug above, the pinned WhatsApp Web version (`2.3000.1014.0`) and its remote cache URL were outdated relative to WhatsApp Web's current DOM/WebSocket structure, so the client authenticated but never completed sync.
  - Fix: updated the remote `webVersionCache` URL to point at a community-maintained stable HTML build (`2.3000.1014589918-alpha.html`), working around the broken selectors.
  - Also added `authenticated` and `auth_failure` event listeners during client startup for better diagnostic visibility in logs before `ready` fires.

---

### Alterado

- **Camada de banco de dados migrada de SQLite para PostgreSQL** _(auto-scheduler.js, scheduler.js, db.js)_
  - Contexto: o `imoveis-database` subjacente foi migrado de um arquivo SQLite local para um servidor PostgreSQL acessado ao vivo pelo CLI, pelo site, e pelas instâncias concorrentes deste robô (`account1/2/3`).
  - `src/db.js` (novo): `pg.Pool` compartilhado, lendo `DATABASE_URL` do ambiente.
  - `auto-scheduler.js` reescrito: acesso direto ao arquivo via `node:sqlite` substituído por queries parametrizadas com `pg`. Acesso às linhas ajustado para os identificadores não-quotados que o Postgres normaliza para minúsculo (`row.ImovelID` → `row.imovelid`).

### Removido

- **Lock distribuído por arquivo e sync do `.db` com o Drive** _(auto-scheduler.js, scheduler.js)_
  - Motivo de existir: o SQLite não lida bem com escrita concorrente entre múltiplos processos, então as 3 instâncias do robô coordenavam via `acquireLock()`/`releaseLock()` (um arquivo de lock no Google Drive) somado a `doBackup("download"/"upload")`, copiando o `.db` inteiro antes/depois de cada ciclo de reserva — caro, e sujeito a deixar um lock travado se uma instância morresse no meio (daí o `LOCK_TIMEOUT_MS` de segurança que existia).
  - Com Postgres, todo esse mecanismo se torna desnecessário: `fetchAndReserveAnnouncements` agora reserva os imóveis dentro de uma única transação usando `INSERT ... ON CONFLICT (ImovelID, Reserved_At) DO NOTHING RETURNING ImovelID` — atômico no nível do banco. Duas instâncias disputando o mesmo imóvel simplesmente não conseguem ter sucesso as duas; sem lock de arquivo, sem ida-e-volta pro Drive.
  - Validado com um teste de concorrência: 3 instâncias simuladas chamando `fetchAndReserveAnnouncements` ao mesmo tempo contra um Postgres real — zero reservas duplicadas, nenhum tipo de lock envolvido.
  - `autoFeedQueue()` do `scheduler.js` simplificado: não envolve mais o ciclo em `acquireLock`/`doBackup`/`releaseLock`.

### Adicionado

- **Dependência `pg`** _(package.json)_ — `^8.13.0`, cliente node-postgres.
- **Dockerfile** (novo) — inicialmente baseado em `ghcr.io/puppeteer/puppeteer:23.9.0`, depois reescrito para `node:18-slim` + Chromium instalado via `apt-get` com `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`/`PUPPETEER_EXECUTABLE_PATH` (ver "Corrigido" abaixo pelo motivo). Roda como o usuário não-root `pptruser` da própria imagem. A instância (`account1/2/3`) é escolhida via `command:` no `docker-compose.yml`, não fica fixa na imagem.

### Corrigido

- **Lógica de "complemento" em `reserveForToday` preservada, não reintroduzida com bug** _(auto-scheduler.js)_
  - A lógica original de retry (se menos vagas do que o pedido foram reservadas, completa com os candidatos restantes) foi portada usando `INSERT ... RETURNING` em vez de contagem manual antes/depois — mesma intenção, agora apoiada numa operação atômica em vez de uma janela entre leitura e escrita.
- **`Could not find Chrome` em runtime, causado pelo `npm ci` rodando como root** _(Dockerfile)_
  - Causa raiz: `npm ci` rodava sob `USER root` (para permitir o `chown` seguinte), então o postinstall do Puppeteer baixava o Chrome para `/root/.cache/puppeteer` — mas o container roda como `pptruser` em runtime, que procura em `/home/pptruser/.cache/puppeteer`. Dois lugares diferentes, então o navegador nunca era encontrado.
  - Correção: trocado para `USER pptruser` antes do `npm ci`, para que o download caia no mesmo diretório de cache que a aplicação consulta em runtime. `COPY --chown=pptruser:pptruser` substitui o `chown -R pptruser:pptruser /app` que existia separado, o que também cortou ~129s de chown recursivo do tempo de build.
- **`webVersionCache` aninhado dentro do `LocalAuth`, ignorado silenciosamente pelo `whatsapp-web.js`** _(client.js)_
  - Causa raiz: `webVersion` e `webVersionCache` estavam aninhados dentro do objeto de opções do `authStrategy: new LocalAuth({...})`, em vez de estarem na raiz das opções do `Client` — o `whatsapp-web.js` lê essas duas chaves do nível raiz da config do `Client`, não do `LocalAuth`, então elas eram silenciosamente ignoradas.
  - Correção: `webVersionCache` (e `webVersion`) movidos para o nível raiz do objeto de opções do `Client`, junto com `authStrategy`.
- **Instância congelava em "Sincronizando..." após ler o QR Code, evento `ready` nunca disparava** _(client.js)_
  - Causa raiz: combinado com o bug de aninhamento acima, a versão fixa do WhatsApp Web (`2.3000.1014.0`) e sua URL de cache remota estavam desatualizadas em relação à estrutura DOM/WebSocket atual do WhatsApp Web, fazendo com que o cliente autenticasse mas nunca completasse a sincronização.
  - Correção: URL do `webVersionCache` remoto atualizada para apontar pra uma build HTML estável mantida pela comunidade (`2.3000.1014589918-alpha.html`), contornando os seletores quebrados.
  - Também adicionados os listeners de eventos `authenticated` e `auth_failure` durante a inicialização do cliente, para melhor rastreabilidade de estado no log antes do `ready` disparar.

---

> **Commit:** `refactor(db): migrate to PostgreSQL, remove file-lock/Drive-sync coordination; feat(docker): add Dockerfile for containerized deployment [v5.0.0]`  
> **Tag:** `v5.0.0`

## [4.0.6] - 2026-07-17

### Fixed

- **WhatsApp Web `_serialized` ID crash cascade** _(package.json, package-lock.json)_
  - Root cause: A July 2026 WhatsApp Web infrastructure update renamed the internal serialized message/contact ID property from `_serialized` to `$1`. Since the library core relies heavily on `_serialized`, this caused a cascading `TypeError` across all message, reaction, media download, and group event pipelines.
  - Fix: Temporarily updated dependencies to track the community pull request fork (`github:lindionez/whatsapp-web.js#feat/fix-_serialized-id-fallback`). This introduces an internal fallback helper (`Base._normalizeId()`) that remaps `$1` values back to `_serialized`, restoring complete downstream compatibility across the event lifecycle until an official npm release is merged.

---

### Corrigido

- **Cascata de crashes por quebra do ID `_serialized` no WhatsApp Web** _(package.json, package-lock.json)_
  - Causa raiz: Uma atualização de infraestrutura do WhatsApp Web em julho de 2026 renomeou a propriedade interna de ID serializado de mensagens e contatos de `_serialized` para `$1`. Como o núcleo da biblioteca depende criticamente do formato `_serialized`, a ausência dele gerava erros de `TypeError` em cascata em todo o pipeline de mensagens, reações, downloads de mídia e eventos de grupo.
  - Correção: Dependências atualizadas temporariamente para apontar para o fork de correção da comunidade (`github:lindionez/whatsapp-web.js#feat/fix-_serialized-id-fallback`). O fork introduz um helper interno (`Base._normalizeId()`) que remapeia propriedades `$1` de volta para `_serialized`, restaurando a compatibilidade completa do ecossistema do bot enquanto o PR oficial aguarda merge.

---

## [4.0.5] - 2026-07-07

### Fixed

- **Puppeteer browser launch failure after unexpected power outage** _(client.js)_
  - Root cause: A sudden power failure corrupted the system's global Chromium binary located at `/usr/bin/chromium` and left stale lock files in the `/tmp` directory. Because the client configuration forced an explicit `executablePath`, the local node_modules browser was bypassed, causing all scheduler instances to fail with `Failed to launch the browser process: Code: null` on reboot.
  - Fix: Cleaned up environment lock files (`/tmp/.com.google.Chrome*`), reinstalled the system's global `chromium` package to repair binary corruption, and added instructions to optionally fall back to Puppeteer's internal managed browser to prevent OS-level disruptions from blocking the boot cycle.

---

### Corrigido

- **Falha na inicialização do navegador Puppeteer após queda de energia** _(client.js)_
  - Causa raiz: Um desligamento abrupto corrompeu o binário global do Chromium do sistema localizado em `/usr/bin/chromium` e deixou arquivos de trava (lock) órfãos no diretório `/tmp`. Como a configuração do cliente forçava um `executablePath` explícito, o navegador local da `node_modules` era ignorado, fazendo com que todas as instâncias do scheduler falhassem com `Failed to launch the browser process: Code: null` no reboot.
  - Correção: Limpeza dos arquivos de lock do ambiente (`/tmp/.com.google.Chrome*`), reinstalação do pacote global `chromium` do sistema para reparar a corrupção do binário, e documentação técnica para opcionalmente utilizar o navegador interno gerenciado do Puppeteer, evitando que instabilidades do sistema operacional bloqueiem o ciclo de boot.

---

> **Commit:** `fix(client): repair chromium binary corruption and remove system locks post power outage [v4.0.5]`  
> **Tag:** `v4.0.5`

## [4.0.4] - 2026-05-22

### Added

- **`!clearReservations` command — clear today's `Dispatched_Today` entries** _(auto-scheduler.js, commands.js)_
  - New command that clears all `Dispatched_Today` reservations for the current day, making those properties available for reservation again on the next `autoFeedQueue` run. Does not affect the current queue or trigger a reload.
  - `clearTodayReservations()` created in `auto-scheduler.js`: deletes rows scoped to `Reserved_At = today`, wrapped in `doBackup("download")` → deletion → `doBackup("upload")` to ensure the Drive reflects the cleanup before the next `autoFeedQueue` runs. `handleResetReservedToday` added to `commands.js` and wired to the `!clearReservations` message handler in `client.js`. `clearTodayReservations` exported from `auto-scheduler.js`.

### Fixed

- **Watchdog never fired overdue slots after restart** _(scheduler.js)_
  - Root cause: `checkMissedDispatches` guarded `state.scheduleDate !== todaySP`, which evaluated to `true` and caused an early return whenever the bot restarted mid-day and the persisted `scheduleDate` did not match the current date in memory — even though the schedule itself was valid and all slots were overdue.
  - Fix: the `scheduleDate !== todaySP` condition removed. The guard now only checks for `!state.scheduleDate`, preserving the intent of skipping execution when no schedule has been initialized without blocking legitimate mid-day restarts.

---

### Adicionado

- **Comando `!clearReservations` — limpa as entradas de `Dispatched_Today` do dia** _(auto-scheduler.js, commands.js)_
  - Novo comando que limpa todas as reservas de `Dispatched_Today` do dia corrente, tornando esses imóveis disponíveis para reserva na próxima execução do `autoFeedQueue`. Não afeta a fila atual nem dispara um recarregamento.
  - Criada função `clearTodayReservations()` em `auto-scheduler.js`: deleta registros com `Reserved_At = today`, envolvida por `doBackup("download")` → deleção → `doBackup("upload")` para garantir que o Drive reflita a limpeza antes do próximo `autoFeedQueue`. `handleResetReservedToday` adicionado ao `commands.js` e conectado ao handler de mensagens `!clearReservations` no `client.js`. `clearTodayReservations` exportado de `auto-scheduler.js`.

### Corrigido

- **Watchdog nunca disparava slots atrasados após restart** _(scheduler.js)_
  - Causa raiz: `checkMissedDispatches` verificava `state.scheduleDate !== todaySP`, o que resultava em retorno antecipado sempre que o bot reiniciava durante o dia e o `scheduleDate` persistido não coincidia com a data atual em memória — mesmo que o schedule fosse válido e todos os slots estivessem atrasados.
  - Correção: condição `scheduleDate !== todaySP` removida. O guard agora verifica apenas `!state.scheduleDate`, preservando a intenção de pular a execução quando nenhum schedule foi inicializado, sem bloquear restarts legítimos no meio do dia.

---

> **Commit:** `feat(commands,auto-scheduler): add !clearReservations command; fix(scheduler): remove scheduleDate guard blocking watchdog on restart [v4.0.4]`  
> **Tag:** `v4.0.4`

---

## [4.0.3] - 2026-05-12

### Fixed

- **Duplicate queue loaded by two instances after the 14th dispatch** _(auto-scheduler.js, scheduler.js)_
  - Root cause: `autoFeedQueue()` started with `doBackup("download")`, which overwrote the local database with the Drive's state before any reservation was written. When two instances triggered `dailyReset()` near-simultaneously, both downloaded the same Drive state (no reservations yet), ran `fetchAndReserveAnnouncements()` independently against their own local copies, and each reserved the same 14 properties. The second instance's `doBackup("upload")` then overwrote the first instance's reservations, leaving `Dispatched_Today` in an inconsistent state. The `INSERT OR IGNORE` guard on `Dispatched_Today` was never reached because both instances wrote to separate local databases before either uploaded.
  - Fix: introduced a **distributed file lock** (`acquireLock` / `releaseLock`) in `auto-scheduler.js`. The lock file is created on the Drive path using `open(LOCK_PATH, "wx")` — an atomic exclusive-create syscall that the kernel guarantees cannot be won by two processes simultaneously. The second instance receives `EEXIST`, logs `Lock not acquired`, and returns `0` without loading any queue. The lock is always released in a `finally` block. Stale locks older than 60 seconds are forcibly removed.
  - `acquireLock` and `releaseLock` exported from `auto-scheduler.js`; `autoFeedQueue` in `scheduler.js` wraps the entire feed cycle inside the lock.

- **`markAsSentInCycle` called at reservation time instead of after confirmed dispatch** _(auto-scheduler.js, dispatcher.js)_
  - Root cause: `markAsSentInCycle` was called inside `fetchAndReserveAnnouncements()`, immediately after `reserveForToday()`. If the process crashed or restarted between queue population and the actual WhatsApp send, the property was permanently consumed from `Dispatch_Cycle` without ever being sent — silently shortening the cycle over time.
  - Fix: `markAsSentInCycle` removed from `fetchAndReserveAnnouncements()`. It is now called in `dispatcher.js` inside `executeDispatch()`, only after at least one group receives the message (`dispatched === true`). Properties that fail entirely (`"error"` status) are not marked in the cycle and will be candidates again in the next cycle reset. `markAsSentInCycle` now manages its own database connection and Drive sync (download → write → upload) so it can be called independently from `dispatcher.js`.

---

### Corrigido

- **Fila duplicada carregada por duas instâncias após o 14º disparo** _(auto-scheduler.js, scheduler.js)_
  - Causa raiz: `autoFeedQueue()` iniciava com `doBackup("download")`, sobrescrevendo o banco local com o estado do Drive antes de qualquer reserva ser gravada. Quando duas instâncias disparavam `dailyReset()` quase simultaneamente, ambas baixavam o mesmo estado do Drive (sem reservas), executavam `fetchAndReserveAnnouncements()` de forma independente em seus bancos locais separados e reservavam os mesmos 14 imóveis. O `doBackup("upload")` da segunda instância sobrescrevia as reservas da primeira, deixando o `Dispatched_Today` em estado inconsistente. O guard `INSERT OR IGNORE` do `Dispatched_Today` nunca era atingido pois ambas gravavam em bancos locais distintos antes de qualquer upload.
  - Correção: introduzido **lock distribuído por arquivo** (`acquireLock` / `releaseLock`) em `auto-scheduler.js`. O arquivo de lock é criado no caminho do Drive via `open(LOCK_PATH, "wx")` — chamada de sistema de criação exclusiva atômica que o kernel garante não poder ser vencida por dois processos simultaneamente. A segunda instância recebe `EEXIST`, loga `Lock not acquired` e retorna `0` sem carregar fila alguma. O lock é sempre liberado no bloco `finally`. Locks órfãos com mais de 60 segundos são removidos forçadamente.
  - `acquireLock` e `releaseLock` exportados de `auto-scheduler.js`; `autoFeedQueue` em `scheduler.js` envolve todo o ciclo de alimentação dentro do lock.

- **`markAsSentInCycle` chamado no momento da reserva em vez de após envio confirmado** _(auto-scheduler.js, dispatcher.js)_
  - Causa raiz: `markAsSentInCycle` era chamado dentro de `fetchAndReserveAnnouncements()`, imediatamente após `reserveForToday()`. Se o processo travasse ou reiniciasse entre a população da fila e o envio real pelo WhatsApp, o imóvel era consumido permanentemente do `Dispatch_Cycle` sem ter sido enviado — encurtando o ciclo silenciosamente ao longo do tempo.
  - Correção: `markAsSentInCycle` removido de `fetchAndReserveAnnouncements()`. Agora é chamado em `dispatcher.js` dentro de `executeDispatch()`, apenas após ao menos um grupo receber a mensagem (`dispatched === true`). Imóveis que falham completamente (status `"error"`) não são marcados no ciclo e voltam a ser candidatos no próximo reset de ciclo. `markAsSentInCycle` agora gerencia sua própria conexão com o banco e sincronização com o Drive (download → escrita → upload) para poder ser chamado de forma independente pelo `dispatcher.js`.

---

> **Commit:** `fix(auto-scheduler,scheduler,dispatcher): distributed file lock for autoFeedQueue, markAsSentInCycle moved to post-dispatch [v4.0.3]`  
> **Tag:** `v4.0.3`

---

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
