# Changelog

All notable changes to this project will be documented in this file.  
Todas as alterações relevantes deste projeto serão documentadas neste arquivo.

Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Baseado em [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
