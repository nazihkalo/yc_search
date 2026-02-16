FROM node:20-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  python3-venv \
  python3-pip \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY requirements-crawl4ai.txt ./
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --upgrade pip \
  && /opt/venv/bin/pip install -r requirements-crawl4ai.txt \
  && /opt/venv/bin/python -m crawl4ai.install \
  && /opt/venv/bin/python -m playwright install --with-deps chromium

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV CRAWL4AI_PYTHON_BIN=/opt/venv/bin/python

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm run start"]
