FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY google.js google-sync.js google-model.js server.js auth.js budget.js database.js schema.sql schema-postgres.sql ./
COPY public ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
