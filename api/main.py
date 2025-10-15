from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from fastapi.middleware.cors import CORSMiddleware

from common.config import ApiSettings
from common.db import get_session_factory

from .auth.service import ensure_bootstrap_admin
from .core.config import get_settings
from .routers import aggregates, auth, export, sessions, tracked


def create_app() -> FastAPI:
    settings: ApiSettings = get_settings()

    app = FastAPI(
        title="SPEC-1 Telegram Presence Tracker",
        version="0.1.0",
        default_response_class=ORJSONResponse,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(tracked.router)
    app.include_router(sessions.router)
    app.include_router(aggregates.router)
    app.include_router(export.router)

    @app.on_event("startup")
    async def on_startup() -> None:
        session_factory = get_session_factory(settings.database)
        async with session_factory() as session:
            await ensure_bootstrap_admin(
                session,
                email=settings.admin_email,
                password=settings.admin_password,
            )
            await session.commit()

    return app


app = create_app()
