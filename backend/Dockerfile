FROM python:3.11-slim

WORKDIR /app/backend

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

RUN mkdir -p /app/backend/data/chroma_store

ENV PYTHONPATH=/app

EXPOSE ${PORT:-8000}

CMD uvicorn backend.api.main:app --host 0.0.0.0 --port ${PORT:-8000}
