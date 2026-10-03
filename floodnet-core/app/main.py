from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, roads, routes, ws
from app.core.config import settings
from app.db.base import Base
from app.db.migrations import run_migrations
from app.db.session import SessionLocal, engine
from app.services.roads import seed_roads, sync_graph_from_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Apply schema migrations safely (e.g. enum update, new columns)
    await run_migrations(engine)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        await seed_roads(db)
        await sync_graph_from_db(db)

    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(roads.router)
app.include_router(routes.router)
app.include_router(ws.router)


@app.get("/")
async def root():
    return {
        "name": "FLOODNET Core",
        "version": "0.1.0",
        "docs": "/docs",
    }
