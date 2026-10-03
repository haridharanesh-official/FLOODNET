from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def run_migrations(engine: AsyncEngine) -> None:
    """Safely apply schema migrations to support dynamic routing attributes and enum values."""
    async with engine.connect() as conn:
        if conn.dialect.name == "postgresql":
            # 1. Update road_status enum values
            await conn.execute(
                text("ALTER TYPE road_status ADD VALUE IF NOT EXISTS 'OPEN';")
            )
            await conn.execute(
                text("ALTER TYPE road_status ADD VALUE IF NOT EXISTS 'FLOODED';")
            )
            await conn.commit()

            # 2. Add routing columns if missing (single statement per execute for asyncpg)
            columns_to_add = [
                "ALTER TABLE roads ADD COLUMN IF NOT EXISTS from_node VARCHAR(64);",
                "ALTER TABLE roads ADD COLUMN IF NOT EXISTS to_node VARCHAR(64);",
                "ALTER TABLE roads ADD COLUMN IF NOT EXISTS distance_m DOUBLE PRECISION DEFAULT 1000.0;",
                "ALTER TABLE roads ADD COLUMN IF NOT EXISTS travel_time_sec DOUBLE PRECISION DEFAULT 120.0;",
                "ALTER TABLE roads ADD COLUMN IF NOT EXISTS flood_confidence DOUBLE PRECISION DEFAULT 0.0;",
                "ALTER TABLE roads ADD COLUMN IF NOT EXISTS flood_coverage DOUBLE PRECISION DEFAULT 0.0;",
                "ALTER TABLE roads ADD COLUMN IF NOT EXISTS last_observed_at TIMESTAMP WITHOUT TIME ZONE;",
                "ALTER TABLE roads ALTER COLUMN confidence DROP NOT NULL;",
                "ALTER TABLE roads ALTER COLUMN confidence SET DEFAULT 0.0;",
            ]
            for col_stmt in columns_to_add:
                await conn.execute(text(col_stmt))
            await conn.commit()

            # 3. Migrate SAFE -> OPEN and BLOCKED -> FLOODED
            await conn.execute(
                text("UPDATE roads SET status = 'OPEN' WHERE status::text = 'SAFE';")
            )
            await conn.execute(
                text("UPDATE roads SET status = 'FLOODED' WHERE status::text = 'BLOCKED';")
            )
            await conn.commit()

            # 4. Copy existing confidence to flood_confidence if needed
            await conn.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'roads' AND column_name = 'confidence'
                        ) THEN
                            UPDATE roads SET flood_confidence = confidence WHERE flood_confidence = 0.0 AND confidence IS NOT NULL;
                        END IF;
                    END $$;
                    """
                )
            )
            await conn.commit()
