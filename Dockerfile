FROM ghcr.io/puppeteer/puppeteer:23.9.0

WORKDIR /app

# A imagem oficial já roda como usuário não-root (pptruser) por padrão —
# só volta pra root para instalar dependências, depois volta pra pptruser.
USER root
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN chown -R pptruser:pptruser /app
USER pptruser

# O número da instância (account1/2/3) é passado via `command:` no
# docker-compose — cada container roda uma sessão do WhatsApp diferente.
ENTRYPOINT ["node", "index.js"]
