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

# 3. Permissões do usuário não-root padrão da imagem (node, UID/GID 1000)
#    Alinhado ao user: "1000:1000" do docker-compose.yml para evitar EACCES em /app
RUN usermod -aG audio,video node \
    && mkdir -p /home/node/Downloads /app \
    && chown -R node:node /home/node /app

# 4. Troca para o usuário seguro
USER node

# 5. Copia e instala as dependências do Node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

# 6. Copia o restante do código-fonte
COPY --chown=node:node . .

# 7. Ponto de entrada da aplicação
ENTRYPOINT ["node", "index.js"]
