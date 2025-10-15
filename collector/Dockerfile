FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY common ./common
COPY collector ./collector

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e . --config-settings editable_mode=compat

VOLUME ["/sessions"]

ENV SESSION_PATH=/sessions/collector.session

CMD ["python", "-m", "collector.app"]
