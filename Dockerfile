FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup -S ocean && adduser -S ocean -G ocean
COPY --from=build --chown=ocean:ocean /app/.next/standalone ./
COPY --from=build --chown=ocean:ocean /app/.next/static ./.next/static
COPY --from=build --chown=ocean:ocean /app/public ./public
USER ocean
EXPOSE 3000
CMD ["node", "server.js"]
