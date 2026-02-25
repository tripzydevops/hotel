"""
Pydantic Models for Hotel Rate Monitor
Provides structured data validation for all API operations.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timezone
from uuid import UUID
from enum import Enum


class AlertType(str, Enum):
    THRESHOLD_BREACH = "threshold_breach"
    COMPETITOR_UNDERCUT = "competitor_undercut"


class TrendDirection(str, Enum):
    UP = "up"
    DOWN = "down"
    STABLE = "stable"


# ===== Hotel Models =====

class HotelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    is_target_hotel: bool = False
    serp_api_id: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    stars: Optional[float] = None
    image_url: Optional[str] = None
    property_token: Optional[str] = None
    preferred_currency: Optional[str] = Field(default="USD", max_length=3)
    fixed_check_in: Optional[date] = None
    fixed_check_out: Optional[date] = None
    default_adults: Optional[int] = 2
    amenities: Optional[List[Any]] = Field(default_factory=list)
    images: Optional[List[Any]] = Field(default_factory=list)
    sentiment_breakdown: Optional[List[Dict[str, Any]]] = None
    pricing_dna: Optional[str] = None
    sentiment_embedding: Optional[List[float]] = None
    embedding_status: Optional[str] = "current"
    reviews: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

    class Config:
        from_attributes = True


class HotelCreate(HotelBase):
    pass


class HotelUpdate(BaseModel):
    name: Optional[str] = None
    is_target_hotel: Optional[bool] = None
    serp_api_id: Optional[str] = None
    location: Optional[str] = None
    preferred_currency: Optional[str] = None
    fixed_check_in: Optional[date] = None
    fixed_check_out: Optional[date] = None
    default_adults: Optional[int] = None


class Hotel(HotelBase):
    id: UUID
    user_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    


# ===== Price Log Models =====

class PriceLogBase(BaseModel):
    price: float = Field(..., gt=0)
    currency: str = Field(default="USD", max_length=3)
    check_in_date: Optional[date] = None
    source: str = Field(default="serpapi")
    vendor: Optional[str] = Field(default=None, description="The specific booking site (e.g. Booking.com)")
    offers: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    room_types: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    search_rank: Optional[int] = None
    serp_api_id: Optional[str] = Field(default=None, description="Global ID for deduplication across users")
    session_id: Optional[UUID] = Field(default=None, description="Links the price log to a specific scan session")


class PriceLogCreate(PriceLogBase):
    hotel_id: UUID


class PriceLog(PriceLogBase):
    id: UUID
    hotel_id: UUID
    recorded_at: datetime
    


# ===== Settings Models =====

class SettingsBase(BaseModel):
    threshold_percent: float = Field(default=2.0, ge=0, le=100)
    check_frequency_minutes: int = Field(default=144, ge=0)
    notification_email: Optional[str] = None
    whatsapp_number: Optional[str] = None
    push_enabled: bool = False
    push_subscription: Optional[Dict[str, Any]] = None
    notifications_enabled: bool = True
    currency: str = Field(default="USD", max_length=3)


class SettingsCreate(SettingsBase):
    pass


class SettingsUpdate(BaseModel):
    threshold_percent: Optional[float] = None
    check_frequency_minutes: Optional[int] = None
    notification_email: Optional[str] = None
    whatsapp_number: Optional[str] = None
    push_enabled: Optional[bool] = None
    push_subscription: Optional[Dict[str, Any]] = None
    notifications_enabled: Optional[bool] = None
    currency: Optional[str] = None

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
    timezone: str = Field(default="UTC")

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
    is_admin_bypass: bool = False
    


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
    currency: str = "USD"
    trend: TrendDirection = TrendDirection.STABLE
    change_percent: float = 0.0
    recorded_at: datetime
    vendor: Optional[str] = None
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    adults: Optional[int] = None
    room_types: List[Dict[str, Any]] = []
    offers: List[Dict[str, Any]] = []
    search_rank: Optional[int] = None
    serp_api_id: Optional[str] = None




class PricePoint(BaseModel):
    price: float
    recorded_at: Optional[datetime] = None
    is_estimated: bool = False


class HotelWithPrice(Hotel):
    """Hotel data enriched with latest price info."""
    price_info: Optional[PriceWithTrend] = None
    price_history: List[PricePoint] = []
    



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
    serp_api_id: Optional[str] = None
    
    class Config:
        from_attributes = True
        extra = "allow"




class ScanSession(BaseModel):
    id: UUID
    user_id: UUID
    session_type: Optional[str] = "manual"
    status: str  # "queued", "processing", "completed", "failed", "partial_success"
    hotels_count: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None
    check_in_date: Optional[date] = None
    check_out_date: Optional[date] = None
    adults: Optional[int] = 2
    currency: Optional[str] = "TRY"
    reasoning_trace: Optional[List[Any]] = None

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
    next_scan_at: Optional[datetime] = None
    last_updated: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        extra = "allow"
        from_attributes = True


class ScanOptions(BaseModel):
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    adults: int = Field(default=2, ge=1, le=10)
    currency: Optional[str] = "TRY"


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
    avg_latency_ms: float = 0.0    # Average scan duration in ms
    error_rate_24h: float = 0.0    # Detailed error rate
    active_nodes: int = 1          # Count of active scraper nodes
    service_role_active: bool = False

class AdminUserCreate(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None

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
    check_frequency_minutes: Optional[int] = None

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
    scan_frequency_minutes: Optional[int] = 0
    max_hotels: int = 5            # Derived from plan
    next_scan_at: Optional[datetime] = None

class AdminDirectoryEntry(BaseModel):
    id: Any  # Can be UUID string or int depending on DB
    name: str
    location: str
    serp_api_id: Optional[str] = None
    created_at: datetime
    
class AdminLog(BaseModel):
    id: UUID
    timestamp: datetime
    level: str  # INFO, ERROR, WARN
    action: str
    details: Optional[str] = None
    user_id: Optional[UUID] = None
    user_name: Optional[str] = None

class AdminDataResponse(BaseModel):
    stats: AdminStats
    users: List[AdminUser] = []
    directory: List[AdminDirectoryEntry] = []
    logs: List[AdminLog] = []

class SchedulerQueueEntry(BaseModel):
    user_id: UUID
    user_name: Optional[str] = "Unknown"
    scan_frequency_minutes: int
    last_scan_at: Optional[datetime] = None
    next_scan_at: datetime
    status: str = "pending" # pending, overdue, running
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
    display_currency: str = "USD"
    # Strategic Indices (100 = Market Average)
    ari: float = 100.0  # Average Rate Index
    mpi: float = 100.0  # Market Penetration Index (Requires Occ)
    rgi: float = 100.0  # Revenue Generation Index (Requires RevPAR)
    sentiment_index: float = 100.0  # Sentiment vs Market Avg
    advisory_msg: Optional[str] = None # Natural language reasoning from Agent
    quadrant_x: float = 0.0 # Normalized ARI offset (-50 to +50)
    quadrant_y: float = 0.0 # Normalized Sentiment offset (-50 to +50)
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
    currency: str = "USD"
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    source: str = "serpapi"


class AdminSettings(BaseModel):
    id: UUID
    maintenance_mode: bool
    signup_enabled: bool
    default_currency: str
    system_alert_message: Optional[str] = None
    updated_at: datetime
    
    class Config:
        from_attributes = True

class AdminSettingsUpdate(BaseModel):
    maintenance_mode: Optional[bool] = None
    signup_enabled: Optional[bool] = None
    default_currency: Optional[str] = None
    system_alert_message: Optional[str] = None


# ===== Membership Plan Models =====

class PlanBase(BaseModel):
    name: str
    price_monthly: float
    hotel_limit: int
    scan_frequency_limit: str = "daily" # hourly, daily, weekly
    monthly_scan_limit: int = 100
    features: List[str] = []
    is_active: bool = True

class PlanCreate(PlanBase):
    pass

class PlanUpdate(BaseModel):
    name: Optional[str] = None
    price_monthly: Optional[float] = None
    hotel_limit: Optional[int] = None
    scan_frequency_limit: Optional[str] = None
    monthly_scan_limit: Optional[int] = None
    features: Optional[List[str]] = None
    is_active: Optional[bool] = None

class MembershipPlan(PlanBase):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True
