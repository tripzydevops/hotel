"""
Pydantic Models for Hotel Rate Monitor
Provides structured data validation for all API operations.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
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
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ===== Price Log Models =====

class PriceLogBase(BaseModel):
    price: float = Field(..., gt=0)
    currency: str = Field(default="USD", max_length=3)
    check_in_date: Optional[date] = None
    source: str = Field(default="serpapi")
    vendor: Optional[str] = Field(default=None, description="The specific booking site (e.g. Booking.com)")
    offers: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    room_types: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class PriceLogCreate(PriceLogBase):
    hotel_id: UUID


class PriceLog(PriceLogBase):
    id: UUID
    hotel_id: UUID
    recorded_at: datetime
    
    class Config:
        from_attributes = True


# ===== Settings Models =====

class SettingsBase(BaseModel):
    threshold_percent: float = Field(default=2.0, ge=0, le=100)
    check_frequency_minutes: int = Field(default=144, ge=1)
    notification_email: Optional[str] = None
    whatsapp_number: Optional[str] = None
    push_enabled: bool = False
    push_subscription: Optional[Dict[str, Any]] = None
    notifications_enabled: bool = True
    currency: str = Field(default="USD", max_length=3)


class SettingsCreate(SettingsBase):
    pass


class SettingsUpdate(SettingsBase):
    pass


class Settings(SettingsBase):
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ===== User Profile Models =====

class UserProfileBase(BaseModel):
    display_name: Optional[str] = None
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: str = Field(default="UTC")


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
    
    class Config:
        from_attributes = True


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
    
    class Config:
        from_attributes = True


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
    offers: List[Dict[str, Any]] = []
    room_types: List[Dict[str, Any]] = []



class PricePoint(BaseModel):
    price: float
    recorded_at: datetime


class HotelWithPrice(Hotel):
    """Hotel data enriched with latest price info."""
    price_info: Optional[PriceWithTrend] = None
    price_history: List[PricePoint] = []
    
    class Config:
        from_attributes = True
        extra = "allow"



class QueryLog(BaseModel):
    id: UUID
    hotel_name: str
    location: Optional[str] = None
    action_type: str
    status: Optional[str] = "success"
    created_at: datetime
    price: Optional[float] = None
    currency: Optional[str] = None
    vendor: Optional[str] = None
    
    class Config:
        from_attributes = True
        extra = "allow"


class ScanSession(BaseModel):
    id: UUID
    user_id: UUID
    session_type: str = "manual"
    status: str = "pending"
    hotels_count: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None
    logs: Optional[List[QueryLog]] = None

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
    last_updated: Optional[datetime] = None


class ScanOptions(BaseModel):
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    adults: int = Field(default=2, ge=1, le=10)
    currency: Optional[str] = "USD"


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
    service_role_active: bool = False

class AdminUserCreate(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None

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


class MarketAnalysis(BaseModel):
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
