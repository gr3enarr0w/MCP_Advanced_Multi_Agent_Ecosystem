FROM node:20-slim

ARG SERVER_DIR

WORKDIR /srv

COPY ${SERVER_DIR} /srv/app

WORKDIR /srv/app

RUN npm install && npm run build

CMD ["node", "dist/index.js"]
