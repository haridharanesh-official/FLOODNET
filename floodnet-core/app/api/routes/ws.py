from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager

router = APIRouter()


@router.websocket("/ws/live")
async def live_updates(websocket: WebSocket):
    await manager.connect(websocket)
    await websocket.send_json({
        "type": "system.connected",
        "message": "Connected to FLOODNET Core",
    })

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
