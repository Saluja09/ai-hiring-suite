# Minimal image for the AI Hiring Suite backend.
#
# Build (from the backend/ directory):
#   docker build -t ai-hiring-suite-backend .
# Run:
#   docker run -p 8000:8000 --env-file .env ai-hiring-suite-backend
#
# Secrets (HUNAR_API_KEY, etc.) are passed at runtime via --env-file or your
# platform's env var settings — never baked into the image.

FROM python:3.11-slim

WORKDIR /app

# Install backend package (pyproject.toml + app/) with no dev extras.
COPY pyproject.toml ./
COPY app ./app

RUN pip install --no-cache-dir .

# SQLite db lives here by default; mount a volume at this path in
# production to persist data across container restarts.
ENV DATABASE_URL=sqlite:///./app.db

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
