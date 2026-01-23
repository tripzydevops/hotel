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
    stars: Optional[int] = None
    image_url: Optional[str] = None
    property_token: Optional[str] = None
    preferred_currency: Optional[str] = Field(default="USD", max_length=3)


class HotelCreate(HotelBase):
    pass


class HotelUpdate(BaseModel):
    name: Optional[str] = None
    is_target_hotel: Optional[bool] = None
    serp_api_id: Optional[str] = None
    location: Optional[str] = None


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



class PricePoint(BaseModel):
    price: float
    recorded_at: datetime


class HotelWithPrice(BaseModel):
    """Hotel data enriched with latest price info."""
    id: UUID
    name: str
    is_target_hotel: bool
    location: Optional[str] = None
    rating: Optional[float] = None
    stars: Optional[int] = None
    image_url: Optional[str] = None
    price_info: Optional[PriceWithTrend] = None
    price_history: List[PricePoint] = []



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


class DashboardResponse(BaseModel):
    """Response for the main dashboard Bento Grid."""
    target_hotel: Optional[HotelWithPrice] = None
    competitors: List[HotelWithPrice] = []
    recent_searches: List[QueryLog] = []
    scan_history: List[QueryLog] = []
    recent_sessions: List[ScanSession] = []
    unread_alerts_count: int = 0
    last_updated: Optional[datetime] = None


class MonitorResult(BaseModel):
    """Result of a monitoring run."""
    hotels_checked: int
    prices_updated: int
    alerts_generated: int
    session_id: Optional[UUID] = None
    errors: List[str] = []


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


class MarketAnalysis(BaseModel):
    market_average: float
    market_min: float
    market_max: float
    target_price: Optional[float] = None
    competitive_rank: int = 0
    price_history: List[PricePoint] = []
    competitors: List[HotelWithPrice] = []


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
