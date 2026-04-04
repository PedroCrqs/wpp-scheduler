# Changelog

All notable changes to this project will be documented in this file.  
Todas as alterações relevantes deste projeto serão documentadas neste arquivo.

Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Baseado em [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
