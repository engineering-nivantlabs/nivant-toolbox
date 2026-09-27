FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
# The client project (workflows, business.yaml, ...) is mounted at /config.
ENV CONFIG_DIR=/config FILES_DIR=/data/files PORT=8080
VOLUME ["/data"]
EXPOSE 8080
USER node
CMD ["node", "dist/cli.js", "start"]
