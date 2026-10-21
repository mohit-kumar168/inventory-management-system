
FROM oven/bun:1.3.0

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN DIRECT_URL=postgresql://localhost:5432/postgres bunx prisma generate

EXPOSE 8000

CMD ["bun", "run", "dev"]

