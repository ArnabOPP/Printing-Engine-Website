FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --omit=dev --workspace server
COPY server/src ./server/src
COPY server/scripts ./server/scripts
COPY shared ./shared
COPY client/public ./server/assets
WORKDIR /app/server
ENV NODE_ENV=production API_ONLY=true PORT=5000 DATA_DIR=/var/data/printing-engine
EXPOSE 5000
CMD ["node", "src/index.js"]
