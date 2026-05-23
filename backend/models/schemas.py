"""
Pydantic Models for Hotel Rate Monitor
Provides structured data validation for all API operations.
"""

from datetime import date, datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

# SYSTEM STANDARDS: All scans follow a unified 4-hour interval pulse.
# Individual user-selectable frequencies have been removed.
SCAN_PULSE_INTERVAL_MINUTES = 240
SCAN_PULSE_INTERVAL_HOURS = 4


class AlertType(str, Enum):
    THRESHOLD_BREACH = "threshold_breach"
    COMPETITOR_UNDERCUT = "competitor_undercut"
    PULSE_ALERT = "pulse_alert"


class TrendDirection(str, Enum):
    UP = "up"
    DOWN = "down"
    STABLE = "stable"


# ===== Standard Response Models =====


class SuccessResponse(BaseModel):
    success: bool = True
    message: str = "Operation completed successfully"
    data: Optional[Dict[str, Any]] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CitiesResponse(BaseModel):
    cities: List[str]


class GlobalPulseStatsResponse(BaseModel):
    total_hotels: int
    scans_24h: int
    avg_price_change: float
    market_sentiment: float
    active_competitors: int


# ===== Hotel Models =====


class HotelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    stars: Optional[float] = None
    image_url: Optional[str] = None
    property_token: Optional[str] = None
    amenities: Optional[List[Any]] = Field(default_factory=list)
    images: Optional[List[Any]] = Field(default_factory=list)
    sentiment_breakdown: Optional[List[Dict[str, Any]]] = None
    sentiment_embedding: Optional[List[float]] = None
    embedding_status: Optional[str] = "current"
    reviews: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

    # New Metadata Fields
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    cid: Optional[str] = None
    place_id: Optional[str] = None

    @field_validator("sentiment_breakdown", "reviews", mode="before")
    @classmethod
    def validate_list_or_none(cls, v: Any) -> Optional[List[Dict[str, Any]]]:
        if v == "" or isinstance(v, dict):
            return []
        return v

    class Config:
        from_attributes = True


class HotelCreate(HotelBase):
    url: Optional[str] = Field(default=None, description="Direct OTA link (Booking, TripAdvisor, Expedia) for identification")


class HotelUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = Field(default=None, description="Direct OTA link for identification")
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    cid: Optional[str] = None
    place_id: Optional[str] = None

    # User-specific association fields
    is_target_hotel: Optional[bool] = None
    is_monitored: Optional[bool] = None
    pricing_dna: Optional[Dict[str, Any]] = None
    preferred_currency: Optional[str] = None
    fixed_check_in: Optional[date] = None
    fixed_check_out: Optional[date] = None
    default_adults: Optional[int] = None


class Hotel(HotelBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ===== User-Hotel Association Models =====


class UserHotelBase(BaseModel):
    is_target: bool = False
    is_monitored: bool = True
    pricing_dna: Optional[Dict[str, Any]] = Field(default_factory=dict)
    preferred_currency: Optional[str] = "TRY"
    fixed_check_in: Optional[date] = None
    fixed_check_out: Optional[date] = None
    default_adults: Optional[int] = 2


class UserHotelCreate(UserHotelBase):
    user_id: UUID
    hotel_id: UUID


class UserHotelUpdate(BaseModel):
    is_target: Optional[bool] = None
    is_monitored: Optional[bool] = None
    pricing_dna: Optional[Dict[str, Any]] = None
    preferred_currency: Optional[str] = None
    fixed_check_in: Optional[date] = None
    fixed_check_out: Optional[date] = None
    default_adults: Optional[int] = None


class UserHotel(UserHotelBase):
    id: UUID
    user_id: UUID
    hotel_id: UUID
    created_at: datetime
    updated_at: datetime


# ===== Price Log Models =====


class PriceLogBase(BaseModel):
    price: float = Field(..., gt=0)
    currency: str = Field(default="TRY", max_length=3)
    check_in_date: Optional[date] = None
    source: str = Field(default="serpapi")
    vendor: Optional[str] = Field(
        default=None, description="The specific booking site (e.g. Booking.com)"
    )
    offers: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    parity_offers: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    market_offers: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    room_types: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    search_rank: Optional[int] = None
    property_token: Optional[str] = Field(
        default=None, description="Global ID for deduplication across users"
    )
    session_id: Optional[UUID] = Field(
        default=None, description="Links the price log to a specific scan session"
    )


class PriceLogCreate(PriceLogBase):
    hotel_id: UUID


class PriceLog(PriceLogBase):
    id: UUID
    hotel_id: UUID
    recorded_at: datetime


# ===== Settings Models =====


class SettingsBase(BaseModel):
    threshold_percent: float = Field(default=2.0, ge=0, le=100)
    notification_email: Optional[str] = None
    whatsapp_number: Optional[str] = None
    push_enabled: bool = False
    push_subscription: Optional[Dict[str, Any]] = None
    notifications_enabled: bool = True
    currency: str = Field(default="TRY", max_length=3)
    dynamic_threshold_enabled: bool = False
    dynamic_threshold_sensitivity: float = Field(default=1.0, ge=0.1, le=5.0)


class SettingsCreate(SettingsBase):
    pass


class SettingsUpdate(BaseModel):
    threshold_percent: Optional[float] = None
    notification_email: Optional[str] = None
    whatsapp_number: Optional[str] = None
    push_enabled: Optional[bool] = None
    push_subscription: Optional[Dict[str, Any]] = None
    notifications_enabled: Optional[bool] = None
    currency: Optional[str] = None
    dynamic_threshold_enabled: Optional[bool] = None
    dynamic_threshold_sensitivity: Optional[float] = None

    class Config:
        extra = "ignore"


class Settings(SettingsBase):
    user_id: UUID
    created_at: datetime
    updated_at: datetime


# ===== User Profile Models =====


class UserProfileBase(BaseModel):
    display_name: Optional[str] = None
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = "UTC"
    theme_preference: Optional[str] = "light"
    language_preference: Optional[str] = "en"

    class Config:
        from_attributes = True
        extra = "allow"


class UserProfileCreate(UserProfileBase):
    pass


class UserProfileUpdate(UserProfileBase):
    pass


class UserProfile(UserProfileBase):
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    plan_type: Optional[str] = "trial"
    subscription_status: Optional[str] = "trial"
    role: Optional[str] = "user"
    is_verified: bool = False
    is_admin_bypass: bool = False
    trial_ends_at: Optional[datetime] = None
    subscription_end_date: Optional[datetime] = None


# ===== Location Models =====


class LocationRegistry(BaseModel):
    country: str
    city: str
    district: Optional[str] = ""
    occurrence_count: int = 1

    class Config:
        from_attributes = True


# ===== Alert Models =====


class AlertBase(BaseModel):
    alert_type: AlertType
    message: str
    old_price: Optional[float] = None
    new_price: Optional[float] = None
    currency: Optional[str] = "TRY"


class AlertCreate(AlertBase):
    hotel_id: UUID


class Alert(AlertBase):
    id: UUID
    user_id: UUID
    hotel_id: UUID
    is_read: bool = False
    created_at: datetime


# ===== Dashboard / Response Models =====


class PriceWithTrend(BaseModel):
    """Price data with calculated trend direction."""

    current_price: float
    previous_price: Optional[float] = None
    currency: str = "TRY"
    trend: TrendDirection = TrendDirection.STABLE
    change_percent: float = 0.0
    recorded_at: datetime
    vendor: Optional[str] = None
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    adults: Optional[int] = None
    room_types: List[Dict[str, Any]] = []
    offers: List[Dict[str, Any]] = []
    parity_offers: List[Dict[str, Any]] = []
    market_offers: List[Dict[str, Any]] = []
    search_rank: Optional[int] = None
    property_token: Optional[str] = None


class PricePoint(BaseModel):
    price: float
    recorded_at: Optional[datetime] = None
    is_estimated: bool = False


class HotelWithPrice(Hotel):
    """Hotel data enriched with latest price info and user association context."""

    price_info: Optional[PriceWithTrend] = None
    price_history: List[PricePoint] = []

    # Association fields (from join table)
    user_id: Optional[UUID] = None
    is_target: bool = False
    is_monitored: bool = True
    pricing_dna: Optional[Dict[str, Any]] = None
    preferred_currency: Optional[str] = "TRY"
    fixed_check_in: Optional[date] = None
    fixed_check_out: Optional[date] = None
    default_adults: Optional[int] = 2


class QueryLog(BaseModel):
    id: UUID
    hotel_name: str
    location: Optional[str] = None
    action_type: str
    status: Optional[str] = "success"
    created_at: Optional[datetime] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    vendor: Optional[str] = None
    session_id: Optional[UUID] = None
    check_in_date: Optional[date] = None
    adults: Optional[int] = 2
    property_token: Optional[str] = None
    api_key_suffix: Optional[str] = None

    class Config:
        from_attributes = True
        extra = "allow"


class ScanSession(BaseModel):
    id: UUID
    user_id: UUID
    session_type: Optional[str] = "manual"
    status: str  # "queued", "processing", "completed", "failed", "partial_success", "intelligence_pending"
    hotels_count: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None
    check_in_date: Optional[date] = None
    check_out_date: Optional[date] = None
    adults: Optional[int] = 2
    children_ages: Optional[List[int]] = Field(default_factory=list)
    currency: Optional[str] = "TRY"
    reasoning_trace: Optional[List[Any]] = None

    @field_validator("reasoning_trace", mode="before")
    @classmethod
    def validate_reasoning_trace(cls, v: Any) -> Optional[List[Any]]:
        if v == "" or v is None:
            return []
        if isinstance(v, str):
            import json

            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        if isinstance(v, dict):
            return [v]
        return v

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    """Response for the main dashboard Bento Grid."""

    target_hotel: Optional[HotelWithPrice] = None
    competitors: List[HotelWithPrice] = []
    recent_searches: List[QueryLog] = []
    scan_history: List[QueryLog] = []
    recent_sessions: List[ScanSession] = []
    unread_alerts_count: int = 0
    comparison_limit: int = 5
    last_updated: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Config:
        extra = "allow"
        from_attributes = True


class ScanOptions(BaseModel):
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    adults: int = Field(default=2, ge=1, le=10)
    children_ages: Optional[List[int]] = Field(default_factory=list)
    currency: Optional[str] = "TRY"
    hotel_ids: Optional[List[UUID]] = None
    skip_intelligence: bool = Field(
        default=False,
        description="If True, skip AI Intelligence generation to save tokens.",
    )
    skip_cache: bool = Field(
        default=False,
        description="If True, skip GlobalPulse cache and fetch fresh from SerpApi.",
    )
    deep_scan: bool = Field(
        default=False,
        description="If True, fetch rich metadata and sentiment using DataForSEO hotel_info.",
    )


class MonitorResult(BaseModel):
    """Result of a monitoring run."""

    hotels_checked: int
    prices_updated: int
    alerts_generated: int
    session_id: Optional[UUID] = None
    errors: List[str] = []


# ===== Admin Models =====


class AdminStats(BaseModel):
    total_users: int
    total_hotels: int
    total_scans: int
    api_calls_today: int
    directory_size: int
    scraper_health: float = 100.0  # Percentage of successful scans in last 24h
    avg_latency_ms: float = 0.0  # Average scan duration in ms
    error_rate_24h: float = 0.0  # Detailed error rate
    active_nodes: int = 1  # Count of active scraper nodes
    service_role_active: bool = False


class AdminUserCreate(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None
    plan_type: Optional[str] = "trial"
    subscription_status: Optional[str] = "trial"
    is_verified: Optional[bool] = True


class AdminUserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    display_name: Optional[str] = None
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    plan_type: Optional[str] = None
    subscription_status: Optional[str] = None
    is_verified: Optional[bool] = None


class AdminUser(BaseModel):
    id: UUID
    display_name: Optional[str] = None
    email: Optional[str] = None  # From auth/settings
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    hotel_count: int
    scan_count: int
    created_at: datetime
    last_active: Optional[datetime] = None
    plan_type: Optional[str] = "trial"
    subscription_status: Optional[str] = "trial"
    is_verified: bool = False


class AdminDirectoryEntry(BaseModel):
    id: Any  # Can be UUID string or int depending on DB
    name: str
    location: str
    property_token: Optional[str] = None
    created_at: datetime


class AdminLog(BaseModel):
    id: UUID
    timestamp: datetime
    level: str  # INFO, ERROR, WARN
    action: str
    details: Optional[str] = None
    user_id: Optional[UUID] = None
    user_name: Optional[str] = None


class SystemLogEntry(BaseModel):
    line: str
    timestamp: Optional[datetime] = None
    level: str = "INFO"
    line_num: Optional[int] = None
    message: Optional[str] = None


class SystemLogsResponse(BaseModel):
    logs: List[SystemLogEntry]
    total_lines: int
    file_path: str


class AdminDataResponse(BaseModel):
    stats: AdminStats
    users: List[AdminUser] = []
    directory: List[AdminDirectoryEntry] = []
    logs: List[AdminLog] = []


class SchedulerQueueEntry(BaseModel):
    user_id: UUID
    user_name: Optional[str] = "Unknown"
    last_scan_at: Optional[datetime] = None
    status: str = "pending"  # pending, overdue, running
    hotel_count: int = 0
    hotels: List[str] = []


class MarketAnalysis(BaseModel):
    hotel_id: Optional[str] = None
    market_average: float
    market_min: float
    market_max: float
    target_price: Optional[float] = None
    competitive_rank: int = 0
    price_history: List[PricePoint] = []
    competitors: List[HotelWithPrice] = []
    display_currency: str = "TRY"
    # Strategic Indices (100 = Market Average)
    ari: float = 100.0  # Average Rate Index
    mpi: float = 100.0  # Market Penetration Index (Requires Occ)
    rgi: float = 100.0  # Revenue Generation Index (Requires RevPAR)
    sentiment_index: float = 100.0  # Sentiment vs Market Avg
    advisory_msg: Optional[str] = None  # Natural language reasoning from Agent
    quadrant_x: float = 0.0  # Normalized ARI offset (-50 to +50)
    quadrant_y: float = 0.0  # Normalized Sentiment offset (-50 to +50)
    quadrant_label: str = "Standard"
    target_rating: float = 0.0
    market_rating: float = 0.0
    sentiment_breakdown: Optional[List[Dict[str, Any]]] = None


class ReportsResponse(BaseModel):
    sessions: List[ScanSession] = []
    weekly_summary: Dict[str, Any] = {}


# ===== SerpApi Response Models =====


class SerpApiHotelPrice(BaseModel):
    """Parsed hotel price from SerpApi response."""

    hotel_name: str
    price: float
    currency: str = "TRY"
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    source: str = "serpapi"


class AdminSettings(BaseModel):
    id: UUID
    maintenance_mode: bool
    signup_enabled: bool
    default_currency: str
    system_alert_message: Optional[str] = None
    scan_interval_hours: int = 4
    scan_adults: int = 2
    scan_children_ages: List[int] = Field(default_factory=list)
    last_global_scan_at: Optional[datetime] = None
    next_global_scan_at: Optional[datetime] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class AdminSettingsUpdate(BaseModel):
    maintenance_mode: Optional[bool] = None
    signup_enabled: Optional[bool] = None
    default_currency: Optional[str] = None
    system_alert_message: Optional[str] = None
    scan_interval_hours: Optional[int] = None
    scan_adults: Optional[int] = None
    scan_children_ages: Optional[List[int]] = None
    last_global_scan_at: Optional[datetime] = None
    next_global_scan_at: Optional[datetime] = None


# ===== Membership Plan Models =====


class PlanBase(BaseModel):
    name: str
    price_monthly: float
    hotel_limit: int
    monthly_scan_limit: int = 100
    features: List[str] = []
    is_active: bool = True


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    price_monthly: Optional[float] = None
    hotel_limit: Optional[int] = None
    monthly_scan_limit: Optional[int] = None
    features: Optional[List[str]] = None
    is_active: Optional[bool] = None


class MembershipPlan(PlanBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ProviderHealth(BaseModel):
    name: str
    status: str  # online, offline
    last_call: Optional[datetime] = None
    success_rate: float = 0.0


class ScanVolume(BaseModel):
    timestamp: datetime
    count: int


class HealthMetrics(BaseModel):
    overall_status: str  # operational, degraded, maintenance
    uptime_24h: float
    avg_latency: float
    active_nodes: int
    last_heartbeat: Optional[datetime] = None
    provider_health: List[ProviderHealth] = []
    scan_volume: List[ScanVolume] = []


class MarketBriefingRequest(BaseModel):
    city: str
    user_id: Optional[str] = None
