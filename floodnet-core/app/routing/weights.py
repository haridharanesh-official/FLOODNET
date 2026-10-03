from datetime import datetime, timezone
from app.core.config import settings
from app.models.road import RoadStatus


def get_risk_multiplier(
    status: RoadStatus,
    open_multiplier: float | None = None,
    unknown_multiplier: float | None = None,
    caution_multiplier: float | None = None,
) -> float:
    """Return the routing cost multiplier for a given road status."""
    op_mult = open_multiplier if open_multiplier is not None else settings.routing_open_multiplier
    un_mult = unknown_multiplier if unknown_multiplier is not None else settings.routing_unknown_multiplier
    ca_mult = caution_multiplier if caution_multiplier is not None else settings.routing_caution_multiplier

    if status == RoadStatus.OPEN:
        return op_mult
    elif status == RoadStatus.UNKNOWN:
        return un_mult
    elif status == RoadStatus.CAUTION:
        return ca_mult
    elif status == RoadStatus.FLOODED:
        # Note: Flooded roads should be completely skipped by the search algorithm.
        return float("inf")
    return un_mult


def calculate_dynamic_weight(
    travel_time_sec: float,
    status: RoadStatus,
    open_multiplier: float | None = None,
    unknown_multiplier: float | None = None,
    caution_multiplier: float | None = None,
) -> float:
    """Calculate the flood-aware dynamic weight for a road segment."""
    multiplier = get_risk_multiplier(
        status=status,
        open_multiplier=open_multiplier,
        unknown_multiplier=unknown_multiplier,
        caution_multiplier=caution_multiplier,
    )
    if multiplier == float("inf"):
        return float("inf")
    return travel_time_sec * multiplier


def compute_freshness(
    last_observed_at: datetime | None,
    timeout_seconds: float | None = None,
) -> float:
    """
    Compute freshness score between 0.0 (very fresh) and 1.0 (stale/expired).
    0.0 = just observed, 1.0 = older than observation timeout.
    """
    if last_observed_at is None:
        return 1.0

    timeout = timeout_seconds if timeout_seconds is not None else settings.road_observation_timeout_seconds
    now = datetime.now(timezone.utc) if last_observed_at.tzinfo else datetime.utcnow()
    delta = (now - last_observed_at).total_seconds()

    if delta <= 0:
        return 0.0
    if delta >= timeout:
        return 1.0
    return delta / timeout


def calculate_flood_risk(
    confidence: float,
    coverage: float,
    freshness: float,
    confidence_weight: float | None = None,
    coverage_weight: float | None = None,
    freshness_weight: float | None = None,
) -> float:
    """
    Prototype flood risk calculation:
    risk = (confidence_weight * confidence) + (coverage_weight * coverage) + (freshness_weight * freshness)
    All inputs normalized to [0.0, 1.0]. Returns risk in [0.0, 1.0].
    """
    w_conf = confidence_weight if confidence_weight is not None else settings.risk_confidence_weight
    w_cov = coverage_weight if coverage_weight is not None else settings.risk_coverage_weight
    w_fresh = freshness_weight if freshness_weight is not None else settings.risk_freshness_weight

    c = max(0.0, min(1.0, confidence))
    v = max(0.0, min(1.0, coverage))
    f = max(0.0, min(1.0, freshness))

    raw_risk = (w_conf * c) + (w_cov * v) + (w_fresh * f)
    total_weights = w_conf + w_cov + w_fresh
    normalized_risk = raw_risk / total_weights if total_weights > 0 else raw_risk
    return max(0.0, min(1.0, normalized_risk))


def classify_flood_risk(
    risk: float,
    open_threshold: float | None = None,
    caution_threshold: float | None = None,
) -> RoadStatus:
    """
    Classify a normalized flood risk score into a RoadStatus:
    - risk < open_threshold: OPEN
    - open_threshold <= risk < caution_threshold: CAUTION
    - risk >= caution_threshold: FLOODED
    """
    t_open = open_threshold if open_threshold is not None else settings.risk_open_threshold
    t_caution = caution_threshold if caution_threshold is not None else settings.risk_caution_threshold

    if risk < t_open:
        return RoadStatus.OPEN
    elif risk < t_caution:
        return RoadStatus.CAUTION
    else:
        return RoadStatus.FLOODED
