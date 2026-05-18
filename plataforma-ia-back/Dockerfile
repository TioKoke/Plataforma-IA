# Stage 1: Builder - install dependencies
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libffi-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim AS runtime

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libmagic1 \
        curl \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libharfbuzz0b \
        libcairo2 \
        libffi8 \
        shared-mime-info \
        fonts-liberation && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser

RUN mkdir -p /app/generated_files /app/output /app/uploads && \
    chown -R appuser:appuser /app

COPY --chown=appuser:appuser app/ ./app/

USER appuser

# Cloud Run inyecta $PORT en runtime (default 8080). En local, sin $PORT,
# se usa 8000.
ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Forma shell para que ${PORT} se expanda en runtime (Cloud Run lo inyecta).
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
