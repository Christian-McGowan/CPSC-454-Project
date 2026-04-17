FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
