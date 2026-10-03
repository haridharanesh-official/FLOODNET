# FLOODNET — Laptop Starter

This repository contains the **laptop-side** FLOODNET services only:

- `floodnet-core` — FastAPI backend, PostgreSQL, road-state logic, WebSocket events
- `floodnet-web` — Next.js dashboard
- `mosquitto` — local MQTT broker reserved for later AI-PC integration

The AI/CCTV service is intentionally **not included** here.

## Phase 1 goal

Prove this flow locally before connecting the AI PC:

1. Core API starts
2. Web dashboard starts
3. Roads are listed
4. A road can be manually changed to SAFE / CAUTION / BLOCKED / UNKNOWN
5. The dashboard receives the update over WebSocket

## Quick start with Docker

```bash
cp .env.example .env
docker compose up --build
```

Then open:

- Web: http://localhost:3000
- API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- PostgreSQL: localhost:5432
- MQTT: localhost:1883

## Manual local development

### Core

```bash
cd floodnet-core
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Web

```bash
cd floodnet-web
npm install
npm run dev
```

## First test

Open http://localhost:3000 and use the road-state buttons.

Or use curl:

```bash
curl -X POST http://localhost:8000/api/v1/roads/ROAD_002/status \
  -H 'Content-Type: application/json' \
  -d '{"status":"BLOCKED","confidence":1.0,"source":"MANUAL_SIMULATION"}'
```

This simulates the exact event that the future AI PC will eventually produce.
