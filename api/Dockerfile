FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY common ./common
COPY api ./api
COPY migrations ./migrations

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e . --config-settings editable_mode=compat

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
