FROM node:20-slim

WORKDIR /srv/github-oauth

COPY src/mcp-servers/github-oauth/package.json ./
COPY src/mcp-servers/github-oauth/package-lock.json ./
COPY src/mcp-servers/github-oauth ./

RUN npm install

CMD ["node", "index.js"]
