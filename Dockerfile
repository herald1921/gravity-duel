FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
COPY server ./server
RUN npm run build:server
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server/index.mjs"]
