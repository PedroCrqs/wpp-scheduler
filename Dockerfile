FROM node:18-slim

# Diretório de trabalho
WORKDIR /app

# 1. Instala o Chromium no sistema operacional (como root)
USER root

RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt-get/lists/*

# 2. Configura o Puppeteer para usar o Chromium do SO
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 3. Criação do usuário sem privilégios e permissões da pasta
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# 4. Troca para o usuário seguro
USER pptruser

# 5. Copia e instala as dependências do Node
COPY --chown=pptruser:pptruser package.json package-lock.json ./
RUN npm ci --omit=dev

# 6. Copia o restante do código-fonte
COPY --chown=pptruser:pptruser . .

# 7. Ponto de entrada da aplicação
ENTRYPOINT ["node", "index.js"]
