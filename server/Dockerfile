
FROM node:22-alpine

WORKDIR /app

COPY server/package*.json ./server/

WORKDIR /app/server

RUN npm install --omit=dev

COPY server/ ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
