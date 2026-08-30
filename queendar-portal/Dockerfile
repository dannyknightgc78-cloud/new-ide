FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server ./server
COPY public ./public
ENV DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 3011
CMD ["node", "server/index.js"]
