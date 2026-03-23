FROM node:22-slim

# Install system Chromium and fonts for Korean + emoji rendering.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
