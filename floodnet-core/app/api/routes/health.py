from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
async def health():
    return {
        "service": "floodnet-core",
        "status": "ok",
        "ai_connected": False,
        "mode": "manual-simulation",
    }
