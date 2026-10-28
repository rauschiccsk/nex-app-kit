# The demo app as one image: the frontend built from the kit's dist, the server package installed from server/,
# the demo's server serving both from one address. Built from the repository root.
FROM node:20-slim AS frontend
WORKDIR /kit
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
COPY demo ./demo
RUN npm run build && npm run demo:build

FROM python:3.12-slim
WORKDIR /app
COPY server/pyproject.toml server/README.md ./server/
COPY server/src ./server/src
RUN pip install --no-cache-dir ./server "psycopg[binary]>=3.2" "uvicorn>=0.30"
COPY demo/server ./demo/server
COPY demo/app.manifest.json ./demo/
COPY demo/docs ./demo/docs
COPY --from=frontend /kit/demo/dist ./demo/dist
WORKDIR /app/demo/server
USER 1000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
