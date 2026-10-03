from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from app.core.config import settings
from app.models.road import RoadStatus


@dataclass
class Observation:
    status: RoadStatus
    confidence: float
    coverage: float
    timestamp: datetime


class RoadStateFilter:
    """
    Anti-flapping and hysteresis filter for road status observations.
    Prevents noisy sensor/camera switching between states.
    Road closure (OPEN -> FLOODED) confirms quickly (e.g., 7 of 10).
    Road reopening (FLOODED -> OPEN) requires strong evidence (e.g., 20 consecutive clear).
    """

    def __init__(
        self,
        open_to_flooded_positive_required: int | None = None,
        open_to_flooded_window_size: int | None = None,
        flooded_to_open_consecutive_clear_required: int | None = None,
    ) -> None:
        self.open_to_flooded_positive_required = (
            open_to_flooded_positive_required
            if open_to_flooded_positive_required is not None
            else settings.anti_flapping_open_to_flooded_positive_required
        )
        self.open_to_flooded_window_size = (
            open_to_flooded_window_size
            if open_to_flooded_window_size is not None
            else settings.anti_flapping_window_size
        )
        self.flooded_to_open_consecutive_clear_required = (
            flooded_to_open_consecutive_clear_required
            if flooded_to_open_consecutive_clear_required is not None
            else settings.anti_flapping_flooded_to_open_consecutive_clear_required
        )

        max_history = max(
            self.open_to_flooded_window_size,
            self.flooded_to_open_consecutive_clear_required,
        )
        self._max_history = max_history
        self._history: dict[str, deque[Observation]] = {}
        self._confirmed: dict[str, RoadStatus] = {}

    def initialize_road(self, road_id: str, status: RoadStatus) -> None:
        self._confirmed[road_id] = status
        if road_id not in self._history:
            self._history[road_id] = deque(maxlen=self._max_history)

    def get_confirmed_status(self, road_id: str) -> RoadStatus:
        return self._confirmed.get(road_id, RoadStatus.UNKNOWN)

    def force_set_status(self, road_id: str, status: RoadStatus) -> None:
        self._confirmed[road_id] = status
        self._history[road_id] = deque(maxlen=self._max_history)

    def process_observation(
        self,
        road_id: str,
        observed_status: RoadStatus,
        confidence: float = 1.0,
        coverage: float = 0.0,
        timestamp: datetime | None = None,
    ) -> tuple[RoadStatus, bool]:
        """
        Record a new observation and return (confirmed_status, has_status_changed).
        """
        ts = timestamp or datetime.now(timezone.utc)
        if road_id not in self._history:
            self._history[road_id] = deque(maxlen=self._max_history)

        current_confirmed = self._confirmed.get(road_id, RoadStatus.UNKNOWN)

        obs = Observation(
            status=observed_status,
            confidence=confidence,
            coverage=coverage,
            timestamp=ts,
        )
        self._history[road_id].append(obs)
        history = list(self._history[road_id])

        new_status = current_confirmed

        if current_confirmed == RoadStatus.FLOODED:
            # Reopening requires N consecutive clear (OPEN) observations
            required_consecutive = self.flooded_to_open_consecutive_clear_required
            if len(history) >= required_consecutive:
                recent = history[-required_consecutive:]
                if all(o.status == RoadStatus.OPEN for o in recent):
                    new_status = RoadStatus.OPEN
        else:
            # Currently not FLOODED
            if observed_status == RoadStatus.FLOODED:
                # Check if at least M out of last W are FLOODED
                window_size = min(len(history), self.open_to_flooded_window_size)
                recent = history[-window_size:]
                flooded_count = sum(1 for o in recent if o.status == RoadStatus.FLOODED)
                if flooded_count >= self.open_to_flooded_positive_required:
                    new_status = RoadStatus.FLOODED
            elif observed_status in (RoadStatus.CAUTION, RoadStatus.UNKNOWN, RoadStatus.OPEN):
                # For non-flooded transitions, update when 2 consecutive observations agree
                # or if the current state was UNKNOWN
                if current_confirmed == RoadStatus.UNKNOWN:
                    new_status = observed_status
                else:
                    recent = history[-2:]
                    if len(recent) >= 2 and all(o.status == observed_status for o in recent):
                        new_status = observed_status
                    elif len(recent) == 1 and recent[0].status == observed_status:
                        if confidence >= 0.8:
                            new_status = observed_status

        has_changed = new_status != current_confirmed
        if has_changed:
            self._confirmed[road_id] = new_status

        return new_status, has_changed


# Global filter instance
road_filter = RoadStateFilter()
