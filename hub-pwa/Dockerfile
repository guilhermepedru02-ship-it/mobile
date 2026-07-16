# Chronos-VPS — Hub PWA (painel de controle)
FROM node:20-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5555
CMD ["node", "server.js"]
