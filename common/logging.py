from __future__ import annotations

import logging
import sys
from typing import Optional

import structlog


def configure_logging(level: str = "INFO", sentry_dsn: Optional[str] = None) -> None:
    """Configure structured logging for the project."""
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(message)s",
        stream=sys.stdout,
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    if sentry_dsn:
        try:
            import sentry_sdk

            sentry_sdk.init(dsn=sentry_dsn, traces_sample_rate=0.0)
        except ImportError:  # pragma: no cover
            logging.getLogger(__name__).warning("sentry_sdk not installed; skipping Sentry init")
