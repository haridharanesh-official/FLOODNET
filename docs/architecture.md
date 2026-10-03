# Laptop-side architecture

```text
Browser / Dashboard
        |
        | REST + WebSocket
        v
FLOODNET Core (FastAPI)
        |
        +---- PostgreSQL
        |
        +---- Road-state engine
        |
        +---- WebSocket broadcaster
        |
        +---- MQTT broker (future AI-PC input)
```

The AI PC will later publish observations to this laptop. It will never receive direct database credentials.
