FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        gnupg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Chromium and its deps (used by scraper_service and og_image_generator)
RUN playwright install chromium --with-deps

COPY . .

EXPOSE 8000
# Shell form (via sh -c) so $PORT is expanded when a platform injects it
# (e.g. Railway); falls back to 8000 for docker-compose / local. `exec`
# makes uvicorn PID 1 so it receives SIGTERM for graceful shutdown.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
