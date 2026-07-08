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
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
