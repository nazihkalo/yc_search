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

# NEXT_PUBLIC_* values get inlined into statically prerendered pages (e.g. the
# landing page) during `next build`, so they must exist at build time. Railway
# only exposes service variables to Dockerfile builds via declared ARGs.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

ARG POSTHOG_PROJECT_KEY
ARG POSTHOG_HOST=https://us.i.posthog.com
ENV POSTHOG_PROJECT_KEY=$POSTHOG_PROJECT_KEY
ENV POSTHOG_HOST=$POSTHOG_HOST

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV CRAWL4AI_PYTHON_BIN=/opt/venv/bin/python

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm run start"]
