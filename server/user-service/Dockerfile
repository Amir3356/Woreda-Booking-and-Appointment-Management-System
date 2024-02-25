# syntax=docker/dockerfile:1
# Build context is this service folder (see docker-compose.yml and .dockerignore).
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
USER node
ENV PORT=8082
EXPOSE 8082
CMD ["node", "index.js"]
