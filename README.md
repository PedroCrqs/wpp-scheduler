# WhatsApp Scheduler Bot

Bot de agendamento de mensagens para WhatsApp que recebe anúncios enviados para si mesmo e os redistribui automaticamente para grupos em horários aleatorizados ao longo do dia. Possui detecção de bairro para segmentação geográfica, suporte a múltiplas contas e mecanismos anti-ban.

---

## Sumário

- [Como funciona](#como-funciona)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Executando](#executando)
- [Comandos disponíveis](#comandos-disponíveis)
- [Segmentação por bairro](#segmentação-por-bairro)
- [Mecanismos anti-ban](#mecanismos-anti-ban)
- [Persistência e arquivos gerados](#persistência-e-arquivos-gerados)
- [Arquitetura dos módulos](#arquitetura-dos-módulos)
- [Adicionando uma nova conta](#adicionando-uma-nova-conta)
- [Gerenciamento com PM2](#gerenciamento-com-pm2)

---

## Como funciona

O bot opera em três etapas principais:

**1. Recebimento.** Você envia uma mensagem de anúncio para o seu próprio número pelo WhatsApp (chat "Você"). O bot detecta a mensagem, extrai o bairro mencionado no texto (padrão `_Bairro_` em itálico), classifica a região geográfica e enfileira a mensagem em um dos 10 slots diários.

**2. Agendamento.** No momento da inicialização (ou após `!clear`), o bot gera 10 horários aleatórios distribuídos de hora em hora entre 09:00 e 18:59. Cada slot recebe um jitter de 0 a 29 minutos para que os disparos nunca caiam no exato início da hora. O cronograma é salvo em disco e sobrevive a reinicializações.

**3. Disparo.** No horário de cada slot, o bot envia a mensagem para todos os grupos-alvo determinados pela classe do bairro. Os grupos recebem a mensagem em ordem embaralhada, com delays variáveis entre envios e inserção de caracteres invisíveis no texto para evitar detecção de duplicata pela Meta. Após cada disparo, o bot envia um relatório de sucesso/falha para o seu próprio número.

Às 19:00 (horário de Brasília) o bot executa o reset diário: zera a fila, gera uma nova grade de horários e registra o log.

---

## Pré-requisitos

- Node.js 18 ou superior
- npm
- Uma conta WhatsApp ativa por instância
- Google Chrome ou Chromium instalado (usado pelo Puppeteer internamente)

---

## Instalação

```bash
git clone <url-do-repositorio>
cd whatsapp-scheduler-bot
npm install whatsapp-web.js qrcode-terminal node-cron
```

---

## Configuração

Toda a configuração fica em `config.js`. Edite o objeto `ACCOUNTS` para cadastrar suas contas e grupos.

### Estrutura de uma conta

```js
// config.js
const ACCOUNTS = {
  account1: {
    // BSUID (@lid) da conta — obtido ao enviar uma mensagem para si mesmo após a primeira conexão)
    myBsuid: "228707713171512@lid",

    // Grupos que recebem TODOS os anúncios, independente do bairro
    generalGroups: [
      "5521970332124-1509473137@g.us",
      // ...
    ],

    // Grupos que recebem apenas anúncios de uma classe geográfica específica
    specificGroups: [
      { id: "5521970445787-1605316109@g.us", class: "BARRA" },
      { id: "120363038446694631@g.us", class: "RECREIO" },
      { id: "5521999014301-1584277277@g.us", class: "RECREIO_BARRA" },
      // ...
    ],
  },
};
```

### Obtendo IDs de grupos

Use o comando `!groups` para listar todos os grupos dos quais o número conectado faz parte, com seus respectivos IDs.

### Obtendo e configurando o ID próprio

...

## Executando

Cada conta é uma instância independente. Passe o nome da conta como argumento:

```bash
# Conta 1
node index.js account1

# Conta 2
node index.js account2
```

No primeiro acesso, um QR Code será exibido no terminal. Escaneie-o com o WhatsApp da conta correspondente. A sessão é salva localmente via `LocalAuth` e não precisará ser refeita em próximas inicializações.

---

## Comandos disponíveis

Envie os comandos para o seu próprio número (chat "Você") no WhatsApp.

| Comando     | Descrição                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `!status`   | Exibe o estado atual: tamanho da fila, disparos feitos, próximo horário e status individual de cada mensagem |
| `!clear`    | Limpa a fila, zera os contadores e gera um novo cronograma de horários                                       |
| `!groups`   | Lista todos os grupos dos quais a conta faz parte, com nome e ID                                             |
| `!fire`     | Dispara imediatamente o próximo slot com status `waiting`                                                    |
| `!fire <n>` | Dispara imediatamente o slot de número `n` (1-based)                                                         |

### Exemplo de saída do `!status`

```
📊 Bot Status

📨 Queue: 3/10
✅ Dispatches done today: 1/10
⏳ Next dispatch: 10:24

Queued messages:
1. [sent]    *• Cobertura - _Barra da Tijuca_* - _3 dorms..._
2. [waiting] *• Apartamento - _Recreio_* - _2 dorms..._
3. [waiting] *• Casa - _Jacarepaguá_* - _4 dorms..._
```

---

## Segmentação por bairro

O bot detecta automaticamente o bairro de cada anúncio buscando o padrão de itálico `_Bairro_` no corpo da mensagem. Com base no bairro identificado, a mensagem é classificada em uma das seguintes classes:

| Classe           | Bairros reconhecidos                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `JACAREPAGUA`    | Jacarepaguá, Pechincha, Freguesia, Taquara, Tanque, Praça Seca, Gardênia Azul, Curicica, Anil |
| `BARRA`          | Barra da Tijuca, Barra                                                                        |
| `RECREIO`        | Recreio dos Bandeirantes, Recreio                                                             |
| `VARGENS`        | Vargem Grande, Vargem Pequena, Vargens, Vargem                                                |
| `BARRA_OLIMPICA` | Barra Olímpica                                                                                |
| `RECREIO_BARRA`  | _(definida pelos grupos, não pelo bairro — ver abaixo)_                                       |
| `GENERAL`        | Bairro não identificado — envia apenas para grupos gerais                                     |

### Lógica de resolução de grupos

Para cada anúncio, o bot monta a lista de destinos da seguinte forma:

- **Sempre inclui** todos os `generalGroups` da conta.
- **Adiciona** os `specificGroups` cuja `class` seja igual à classe do anúncio.
- **Grupos `RECREIO_BARRA`** são incluídos quando o anúncio é de classe `BARRA` ou `RECREIO` — são grupos que recebem as duas regiões.
- IDs duplicados são removidos automaticamente via `Set`.

Se o bairro não for identificado (classe `GENERAL`), nenhum grupo específico é adicionado — apenas os grupos gerais recebem a mensagem.

---

## Mecanismos anti-ban

O bot implementa três camadas de proteção contra suspensão de conta:

**Ordem de envio aleatória.** A lista de grupos-alvo é embaralhada a cada disparo usando o algoritmo Fisher-Yates imparcial, de forma que os grupos nunca recebem mensagens na mesma sequência.

**Delays variáveis entre envios.** Após cada mensagem enviada, o bot aguarda um tempo aleatório antes de prosseguir para o próximo grupo:

- Entre envios individuais: 4 a 12 segundos
- A cada 5 grupos enviados: pausa maior de 15 a 35 segundos

**Micro-variação de texto.** Antes de cada envio, um caractere Unicode invisível (`\u200B`, `\u200C`, `\u200D` ou `\uFEFF`) é inserido em uma posição aleatória do corpo da mensagem. Isso impede que a Meta identifique as mensagens como cópias idênticas sendo enviadas em massa.

---

## Persistência e arquivos gerados

Todos os dados de runtime ficam isolados do código-fonte dentro de `data/`, criada automaticamente na primeira execução:

```
data/
├── sessions/
│   ├── session-scheduler-bot-account1/   ← sessão WhatsApp (LocalAuth)
│   └── session-scheduler-bot-account2/
├── queues/
│   ├── queue-account1.json
│   └── queue-account2.json
├── schedules/
│   ├── schedule-account1.json
│   └── schedule-account2.json
└── logs/
    ├── log-account1.json
    └── log-account2.json
```

| Arquivo                               | Conteúdo                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `queues/queue-{instância}.json`       | Fila do dia atual com status de cada mensagem (`waiting`, `sending`, `sent`, `error`) |
| `schedules/schedule-{instância}.json` | Cronograma de horários do dia atual (10 slots HH:MM)                                  |
| `logs/log-{instância}.json`           | Últimas 500 entradas do log de atividade (tipo, detalhe e timestamp)                  |
| `sessions/`                           | Sessão de autenticação do WhatsApp — não precisa escanear o QR Code a cada restart    |

A fila e o cronograma sobrevivem a reinicializações dentro do mesmo dia. Na inicialização, o bot verifica se há mensagens em `waiting` com horário já passado e as dispara imediatamente (mecanismo de catch-up).

No reset diário das 19:00 ou ao executar `!clear`, fila e cronograma são regenerados. A sessão **nunca** é apagada pelo bot.

> **Dica:** adicione `data/` ao `.gitignore` para evitar que sessões, filas e logs sejam commitados acidentalmente.

---

## Arquitetura dos módulos

```
index.js          — ponto de entrada: inicializa o cliente e registra o cron de reset diário
│
├── config.js     — constantes: INSTANCE, ACCOUNTS, paths de arquivo, NEIGHBORHOOD_CLASSES
├── state.js      — estado mutável centralizado (fila, schedule, flags de disparo)
│
├── client.js     — inicialização do whatsapp-web.js, handlers de eventos (qr, ready,
│                   message_create) e roteamento de comandos
│
├── commands.js   — implementação de !status, !clear, !groups, !fire
│
├── scheduler.js  — geração de horários, agendamento via node-cron, reset diário
│
├── dispatcher.js — fila sequencial de disparos (pendingDispatches + while loop),
│                   execução de cada slot com anti-ban
│
├── neighborhood.js — extração de bairro via regex, classificação geográfica,
│                     resolução da lista de grupos-alvo
│
├── persistence.js  — leitura e escrita de fila, schedule e log em disco
│
└── helpers.js    — sleep(), shuffle() Fisher-Yates, microVary() com chars invisíveis
```

O estado da aplicação trafega inteiramente por `state.js` — nenhum módulo mantém variáveis globais próprias. Dependências circulares entre `dispatcher` ↔ `scheduler` ↔ `client` são resolvidas com imports lazy (dentro das funções que os utilizam).

---

## Adicionando uma nova conta

1. Adicione uma entrada em `ACCOUNTS` dentro de `config.js`:

```js
account3: {
  myBsuid: "",           // preencher após o primeiro login
  generalGroups: [
    "ID_DO_GRUPO@g.us",
    // ...
  ],
  specificGroups: [
    { id: "ID_DO_GRUPO@g.us", class: "BARRA" },
    // ...
  ],
},
```

2. Inicie a instância e escaneie o QR Code:

```bash
node index.js account3
```

3. Copie o valor de `BSUID` exibido no console e preencha `myBsuid` no config.

---

## Gerenciamento com PM2

Para manter as instâncias rodando em background e com reinício automático:

```bash
npm install -g pm2

# Iniciar as instâncias
pm2 start index.js --name "bot-account1" -- account1
pm2 start index.js --name "bot-account2" -- account2

# Salvar e configurar para iniciar com o sistema
pm2 save
pm2 startup

# Comandos úteis
pm2 list                        # status de todas as instâncias
pm2 logs bot-account1           # logs em tempo real
pm2 restart bot-account1        # reiniciar uma instância
pm2 stop bot-account1           # parar uma instância
```
