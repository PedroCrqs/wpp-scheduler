# WhatsApp Scheduler Bot (v5.1.0)

Bot automatizado para WhatsApp que realiza o agendamento e disparo inteligente de anúncios imobiliários para grupos, com auto-alimentação via banco PostgreSQL compartilhado, segmentação geográfica por bairros, controle de concorrência atômico entre múltiplas instâncias e mecanismos avançados anti-ban.

---

## Sumário

- [Visão Geral e Arquitetura](#visão-geral-e-arquitetura)
- [Como Funciona](#como-funciona)
  - [1. Auto-Alimentação e Concorrência (PostgreSQL)](#1-auto-alimentação-e-concorrência-postgresql)
  - [2. Grade de Agendamento (14 Slots Diários)](#2-grade-de-agendamento-14-slots-diários)
  - [3. Disparo com Mecanismos Anti-Ban](#3-disparo-com-mecanismos-anti-ban)
  - [4. Watchdog e Catch-up](#4-watchdog-e-catch-up)
- [Segmentação por Bairro](#segmentação-por-bairro)
- [Comandos no WhatsApp](#comandos-no-whatsapp)
- [Configuração](#configuração)
  - [Estrutura de Contas e Grupos](#estrutura-de-contas-e-grupos)
  - [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Executando](#executando)
  - [Execução Direta (Node.js)](#execução-direta-nodejs)
  - [Gerenciamento com PM2](#gerenciamento-com-pm2)
  - [Deploy com Docker](#deploy-com-docker)
- [Persistência e Arquivos Gerados](#persistência-e-arquivos-gerados)
- [Estrutura de Módulos](#estrutura-de-módulos)

---

## Visão Geral e Arquitetura

O bot foi projetado para operar com **múltiplas contas/instâncias simultâneas** (`account1`, `account2`, `account3`), compartilhando uma base central de imóveis no **PostgreSQL** (`imoveis-database`):

```
                     ┌─────────────────────────────┐
                     │   PostgreSQL (imoveis.db)   │
                     │  - Imoveis (Disponíveis)    │
                     │  - Dispatched_Today         │
                     │  - Dispatch_Cycle           │
                     └──────────────┬──────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
    │   account1   │         │   account2   │         │   account3   │
    │ (wpp-web.js) │         │ (wpp-web.js) │         │ (wpp-web.js) │
    └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
           │                        │                        │
           ▼                        ▼                        ▼
     Grupos Gerais            Grupos Gerais            Grupos Gerais
           +                        +                        +
   Grupos Específicos       Grupos Específicos       Grupos Específicos
   (Barra, Recreio,         (Barra, Recreio,         (Barra, Recreio,
    Zona Sul, JPA...)        Zona Sul, JPA...)        Zona Sul, JPA...)
```

---

## Como Funciona

### 1. Auto-Alimentação e Concorrência (PostgreSQL)

Diferente das versões legadas que dependiam de envio manual de mensagens para si mesmo, o bot se auto-alimenta diretamente do banco de dados relacional:

1. **Seleção de Imóveis:** No boot ou no reset diário, o bot consulta até 14 imóveis com `ImovelStatus = 'Disponível'`.
2. **Ciclo Independente (`Dispatch_Cycle`):** Cada conta percorre seu próprio ciclo. Um imóvel só volta a ser enviado pela mesma conta após todos os imóveis disponíveis terem sido disparados por ela ao menos uma vez.
3. **Reserva Atômica Diária (`Dispatched_Today`):** Para evitar que duas ou mais instâncias disparem o mesmo imóvel no mesmo dia, a reserva utiliza inserção transacional atômica:
   ```sql
   INSERT INTO Dispatched_Today (ImovelID, Instance, Reserved_At)
   VALUES ($1, $2, $3)
   ON CONFLICT (ImovelID, Reserved_At) DO NOTHING
   RETURNING ImovelID;
   ```
   Caso haja corrida entre instâncias, a perdedora automaticamente busca o próximo candidato até completar seus 14 slots.

### 2. Grade de Agendamento (14 Slots Diários)

O robô distribui os envios ao longo do dia em **14 slots horários**, entre **09:00 e 22:59**:
- **Horários-base:** 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00, 20:00, 21:00 e 22:00.
- **Jitter Aleatório:** Cada slot recebe um acréscimo de **0 a 45 minutos** (`minute + Math.random() * 46`).
- **Reset Automático:** Um cron diário agendado para **00:00 (horário de Brasília)** limpa a fila do dia anterior, gera novos horários e puxa 14 novos imóveis do banco.

### 3. Disparo com Mecanismos Anti-Ban

Para proteger as contas de WhatsApp contra bloqueios da Meta:

- **Embaralhamento (Fisher-Yates):** A cada disparo, a ordem dos grupos de destino é embaralhada para nunca repetir a mesma sequência.
- **Delays Dinâmicos:**
  - Intervalo de 4 a 12 segundos entre o envio para cada grupo.
  - Pausa estendida de 15 a 35 segundos a cada 5 grupos enviados.
- **Micro-variação Invisível:** Antes de cada envio, caracteres Unicode invisíveis (`\u200B`, `\u200C`, `\u200D` ou `\uFEFF`) são injetados aleatoriamente no texto para invalidar hashes de mensagem duplicada.
- **Formatação Específica por Conta:** Aplicação opcional de normalizações visuais (`mergeFormat` / `mergeFormat2`) dependendo da instância.

### 4. Watchdog e Catch-up

Se uma instância ficar offline ou reiniciar durante o dia:
- O **Watchdog** roda a cada verificação dentro da janela operacional (09:00 às 22:00).
- Identifica slots que ficaram com status `waiting` após o horário programado ter passado.
- O primeiro slot atrasado é disparado imediatamente; slots atrasados subsequentes recebem um espaçamento seguro aleatório (20 a 30 minutos).

---

## Segmentação por Bairro

O bot analisa o campo `Descricao` do imóvel buscando a primeira ocorrência entre sublinhados (`_Bairro_`). Em seguida, classifica o bairro e define os grupos de destino:

| Classe           | Bairros e Termos Reconhecidos                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ZONA_SUL`       | **18 Bairros Oficiais:** Botafogo, Catete, Copacabana, Cosme Velho, Flamengo, Gávea, Glória, Humaitá, Ipanema, Jardim Botânico, Lagoa, Laranjeiras, Leblon, Leme, Rocinha, São Conrado, Urca, Vidigal.<br>**Sub-regiões:** Arpoador, Horto, Fonte da Saudade, "Zona Sul". |
| `BARRA`          | Barra da Tijuca, Barra                                                                                                                                                                                 |
| `RECREIO`        | Recreio dos Bandeirantes, Recreio                                                                                                                                                                      |
| `JACAREPAGUA`    | Jacarepaguá, Pechincha, Freguesia, Taquara, Tanque, Praça Seca, Gardênia Azul, Curicica, Anil                                                                                                           |
| `VARGENS`        | Vargem Grande, Vargem Pequena, Vargens, Vargem                                                                                                                                                         |
| `BARRA_OLIMPICA` | Barra Olímpica                                                                                                                                                                                         |
| `RECREIO_BARRA`  | *(Classe exclusiva de grupos)*: Recebe anúncios classificados como `BARRA` ou `RECREIO`.                                                                                                               |
| `GENERAL`        | Bairro não catalogado ou ausente — enviado exclusivamente para a lista geral de grupos.                                                                                                                |

### Resolução de Grupos (`resolveGroups`)

- **Grupos Gerais (`generalGroups`):** Recebem **todos** os anúncios disparados pela conta.
- **Grupos Específicos (`specificGroups`):** Recebem apenas se a classe do grupo corresponder à classe do anúncio (ou se for `RECREIO_BARRA` para Barra/Recreio).
- Duplicatas de grupos são automaticamente eliminadas via `Set`.

---

## Comandos no WhatsApp

Envie os comandos diretamente para o seu próprio número (chat "Você"):

| Comando               | Descrição                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `!status`             | Exibe status da fila (X/14), total de disparos concluídos, próximo horário e listagem detalhada.     |
| `!reset`              | Executa reset manual imediato: limpa a fila, gera novos horários e carrega 14 imóveis do PostgreSQL. |
| `!clear`              | Limpa a fila e cronograma manualmente sem recarregar do banco.                                        |
| `!fire`               | Dispara imediatamente o próximo anúncio pendente (`waiting`).                                         |
| `!fire <n>`           | Força o disparo manual do slot número `n` (de 1 a 14).                                                |
| `!groups`             | Lista todos os grupos dos quais a conta participa, com nomes e seus respectivos IDs (`@g.us`).        |
| `!clearReservations`  | Remove as reservas da data de hoje na tabela `Dispatched_Today` (útil para testes de concorrência).   |
| `!stopMidnightReset`  | Desativa o agendador de reset automático da meia-noite (00:00).                                       |

---

## Configuração

O arquivo central de configuração é o [`src/config.js`](file:///home/pedrocrqs/main-project-database/wpp-scheduler/src/config.js).

### Estrutura de Contas e Grupos

```javascript
// src/config.js
const ACCOUNTS = {
  account1: {
    myBsuid: "228707713171512@lid",
    generalGroups: [
      "5521970332124-1509473137@g.us",
      "120363154129227809@g.us",
      // ...
    ],
    specificGroups: [
      { id: "5521970445787-1605316109@g.us", class: "BARRA" },
      { id: "5521997856010-1512486103@g.us", class: "ZONA_SUL" },
      { id: "120363204376147970@g.us", class: "ZONA_SUL" },
      { id: "120363038446694631@g.us", class: "RECREIO" },
      // ...
    ],
  },
  // account2, account3...
};
```

### Variáveis de Ambiente

- `DATABASE_URL`: String de conexão com o PostgreSQL (Padrão: `postgresql://postgres:postgres@localhost:5432/imoveis`).

---

## Executando

### Execução Direta (Node.js)

```bash
# Executa especificando a conta como argumento
node index.js account1

# Em modo de desenvolvimento com auto-reload
node --watch index.js account1
```

No primeiro acesso, escaneie o QR Code exibido no terminal. A sessão será salva em `data/account1/sessions` via `LocalAuth`.

### Gerenciamento com PM2

Recomendado para produção:

```bash
# Iniciar as instâncias configuradas
pm2 start index.js --name "wpp-account1" -- account1
pm2 start index.js --name "wpp-account2" -- account2
pm2 start index.js --name "wpp-account3" -- account3

# Salvar processos para inicialização automática no boot do sistema
pm2 save
pm2 startup
```

### Deploy com Docker

O projeto possui um [`Dockerfile`](file:///home/pedrocrqs/main-project-database/wpp-scheduler/Dockerfile) baseado em `node:18-slim` com Chromium instalado via sistema operacional:

```bash
# Build da imagem
docker build -t wpp-scheduler .

# Execução com montagem dos volumes de persistência
docker run -d \
  --name wpp-acc1 \
  -e DATABASE_URL="postgresql://user:password@host:5432/imoveis" \
  -v $(pwd)/data:/app/data \
  wpp-scheduler account1
```

---

## Persistência e Arquivos Gerados

Os dados de cada instância são isolados em pastas próprias dentro de `data/`:

```
data/
└── account1/
    ├── sessions/    # Sessões do WhatsApp Web (LocalAuth)
    ├── queues/      # Fila diária com status (queue-account1.json)
    ├── schedules/   # Horários dos 14 slots do dia (schedule-account1.json)
    └── logs/        # Log rotativo com os últimos 500 eventos (log-account1.json)
```

---

## Estrutura de Módulos

```
index.js              Ponto de entrada: inicialização e listeners de ciclo de vida
src/
├── config.js         Configurações, contas, mapeamento de grupos e classes de bairros
├── db.js             Pool de conexão com PostgreSQL (pg.Pool)
├── auto-scheduler.js Reserva atômica diária e sincronização com o banco
├── scheduler.js      Geração dos 14 horários com jitter, watchdog e reset diário
├── dispatcher.js     Motor de despacho sequencial com anti-ban (delays, micro-variação)
├── neighborhood.js   Extração de bairro via regex, classificação e resolução de grupos
├── client.js         Instanciação do whatsapp-web.js e roteador de mensagens/comandos
├── commands.js       Tratamento dos comandos (!status, !reset, !fire, !clear, etc.)
├── persistence.js    Persistência atômica da fila, agendamento e logs em JSON
├── helpers.js        Utilitários (sleep, Fisher-Yates shuffle, microVary invisível)
└── state.js          Estado global compartilhado em runtime
```
