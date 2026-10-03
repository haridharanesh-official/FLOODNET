import enum
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class RoadStatus(str, enum.Enum):
    OPEN = "OPEN"
    CAUTION = "CAUTION"
    FLOODED = "FLOODED"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def _missing_(cls, value: object):
        if isinstance(value, str):
            val_upper = value.upper()
            if val_upper in ("SAFE", "OPEN"):
                return cls.OPEN
            if val_upper in ("BLOCKED", "FLOODED"):
                return cls.FLOODED
            if val_upper == "CAUTION":
                return cls.CAUTION
            if val_upper == "UNKNOWN":
                return cls.UNKNOWN
        return super()._missing_(value)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Road(Base):
    __tablename__ = "roads"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    road_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    from_node: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    to_node: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    distance_m: Mapped[float] = mapped_column(Float, default=1000.0, nullable=False)
    travel_time_sec: Mapped[float] = mapped_column(Float, default=120.0, nullable=False)
    status: Mapped[RoadStatus] = mapped_column(
        Enum(RoadStatus, name="road_status", values_callable=lambda obj: [e.value for e in obj]),
        default=RoadStatus.UNKNOWN,
        nullable=False,
    )
    flood_confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, default=0.0, nullable=True)
    flood_coverage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    source: Mapped[str] = mapped_column(String(100), default="SYSTEM", nullable=False)
    last_observed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )
