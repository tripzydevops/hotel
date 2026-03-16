import {
  DashboardData,
  MonitorResult,
  Alert,
  QueryLog,
  AdminStats,
  AdminUser,
  AdminUserUpdate,
  AdminDirectoryEntry,
  DirectoryEntry,
  AdminLog,
  KeyStatus,
  MarketIntelligenceResponse,
  Report,
} from "@/types";

// EXPLANATION: Environment-aware API Configuration
//
// Dynamically resolves the API base URL. Use localhost in development
// and a relative proxy path (/p-api) in production to avoid CORS blocks
// across varying Vercel deployment URLs and preview environments.

const isProduction = process.env.NODE_ENV === 'production' || 
                    process.env.VERCEL_ENV === 'production' ||
                    (typeof window !== 'undefined' && 
                     !window.location.hostname.includes('localhost') && 
                     !window.location.hostname.includes('127.0.0.1'));

// Local API routes (handled by the Next.js/Vercel Backend)
export const LOCAL_API_URL = ''; 
export const API_BASE_URL = LOCAL_API_URL; // Alias for backward compatibility

// InsForge Remote services (handled by the Bridge)
export const REMOTE_API_URL = isProduction
  ? (typeof window !== 'undefined' ? window.location.origin + '/p-api' : '/p-api')
  : 'http://localhost:8000/p-api';

if (typeof window !== 'undefined') {
  console.log(`[ApiClient] Mode: ${isProduction ? 'Production' : 'Development'}`);
}

class ApiClient {
  public readonly baseURL = LOCAL_API_URL;

  public async getHeaders(): Promise<HeadersInit> {
    const token = await this.getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) {
      (headers as any)["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  private async getToken(): Promise<string | null> {
    try {
      const { insforge } = await import("@/lib/insforge");
      const { data: { session } } = await insforge.auth.getCurrentSession();
      return session?.accessToken || null;
    } catch (e) {
      console.error("[ApiClient] Unexpected error getting token:", e);
      return null;
    }
  }


  private async fetch<T>(
    endpoint: string,
    options?: RequestInit & { authenticated?: boolean },
  ): Promise<T> {
    const shouldAuthenticate = options?.authenticated !== false;

    // Get session token safely
    const token = shouldAuthenticate ? await this.getToken() : null;
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options?.headers,
    };

    if (token) {
      (headers as any)["Authorization"] = `Bearer ${token}`;
    }

    const url = `${LOCAL_API_URL}${endpoint}`;
    console.log(`[ApiClient] Requesting ${endpoint}...`);

    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      headers,
    });

    console.log(`[ApiClient] Response [${response.status}] ${endpoint}`);

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail
            .map((e: any) => `${e.loc?.join(".") || "unknown"}: ${e.msg}`)
            .join(", ");
        } else {
          errorMessage = errorData.message || errorData.error || errorMessage;
        }
      } catch (e) {
        // Ignore JSON parse error, stick to statusText
      }
      throw new Error(`API Error: ${errorMessage}`);
    }

    return response.json();
  }

  public async getHotel(hotelId: string): Promise<any> {
    return this.fetch<any>(`/api/hotels/${hotelId}`);
  }

  async getDashboard(userId?: string): Promise<DashboardData> {
    const params = userId ? `?user_id=${userId}` : "";
    const data = await this.fetch<DashboardData>(`/api/dashboard${params}`);
    console.log(`[DashboardDebug] Received data for user ${userId || 'Self'}:`, {
      hasProfile: !!data.profile,
      profileKeys: data.profile ? Object.keys(data.profile) : [],
      hotelCount: data.hotels?.length || data.competitors?.length,
      hasTarget: !!data.target_hotel,
      debugInfo: data.debug_info
    });
    return data;
  }

  async triggerMonitor(
    options?: {
      check_in?: string;
      check_out?: string;
      adults?: number;
      currency?: string;
    },
  ): Promise<MonitorResult> {
    return this.fetch<MonitorResult>(`/api/monitor`, {
      method: "POST",
      body: options ? JSON.stringify(options) : undefined,
    });
  }

  async getAlerts(unreadOnly = false): Promise<Alert[]> {
    return this.fetch<Alert[]>(
      `/api/alerts?unread_only=${unreadOnly}`,
    );
  }

  async markAlertRead(alertId: string): Promise<void> {
    return this.fetch<void>(`/api/alerts/${alertId}/read`, {
      method: "PATCH",
    });
  }

  async clearAlerts(): Promise<void> {
    return this.fetch<void>(`/api/alerts/user`, {
      method: "DELETE",
    });
  }

  async deleteAlert(alertId: string): Promise<void> {
    return this.fetch<void>(`/api/alerts/${alertId}`, {
      method: "DELETE",
    });
  }
  async addHotel(
    name: string,
    location: string,
    isTarget: boolean,
    currency: string = "TRY",
    serpApiId?: string,
  ): Promise<void> {
    return this.fetch<void>(`/api/hotels`, {
      method: "POST",
      body: JSON.stringify({
        name,
        location,
        is_target_hotel: isTarget,
        preferred_currency: currency,
        serp_api_id: serpApiId,
      }),
    });
  }

  async updateSettings(settings: any): Promise<void> {
    return this.fetch<void>(`/api/settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  async getSettings(): Promise<any> {
    return this.fetch<any>(`/api/settings`);
  }

  async getProfile(userId?: string): Promise<any> {
    const params = userId ? `?user_id=${userId}` : "";
    return this.fetch<any>(`/api/profile${params}`);
  }

  async searchDirectory(query: string, city?: string): Promise<any[]> {
    // EXPLANATION: Parameterized Search
    // Updated to support an optional city filter in the query string.
    let url = `/api/v1/directory/search?q=${encodeURIComponent(query)}`;
    if (city) {
      url += `&city=${encodeURIComponent(city)}`;
    }
    console.log("[API] Searching:", url);
    return this.fetch<any[]>(url, { authenticated: false });
  }
  async addHotelToDirectory(
    name: string,
    location: string,
    serpApiId?: string,
  ): Promise<void> {
    return this.fetch<void>(`/api/admin/directory`, {
      method: "POST",
      body: JSON.stringify({ name, location, serp_api_id: serpApiId }),
    });
  }

  async syncDirectory(): Promise<{ synced_count: number }> {
    return this.fetch<{ synced_count: number }>(`/api/admin/sync`);
  }

  async deleteLog(logId: string): Promise<void> {
    return this.fetch<void>(`/api/logs/${logId}`, {
      method: "DELETE",
    });
  }

  async deleteHotel(hotelId: string): Promise<void> {
    return this.fetch<void>(`/api/hotels/${hotelId}`, {
      method: "DELETE",
    });
  }

  // EXPLANATION: Fetches a single scan session by ID.
  // Used by ScanSessionModal to poll for live reasoning_trace and status updates
  // so the Agent Mesh visualization and Reasoning Timeline update in real-time.
  async getSession(sessionId: string): Promise<any> {
    return this.fetch<any>(`/api/sessions/${sessionId}`);
  }

  async getSessionLogs(sessionId: string): Promise<QueryLog[]> {
    return this.fetch<QueryLog[]>(`/api/sessions/${sessionId}/logs`);
  }

  async exportSessionCsv(sessionId: string): Promise<void> {
    const token = await this.getToken();
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${LOCAL_API_URL}/api/sessions/${sessionId}/export/csv`;
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) throw new Error("CSV Export failed");

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    const timestamp = new Date().toISOString().split("T")[0];
    a.download = `scan_session_${sessionId.slice(0, 8)}_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }

  async getAnalysis(currency?: string): Promise<any> {
    // EXPLANATION: Explicit Path Separation
    const url = `/api/analysis`;
    const params = currency ? `?currency=${currency}` : "";
    return this.fetch<any>(`${url}${params}`);
  }

  async getAnalysisWithFilters(
    queryParams: string,
  ): Promise<any> {
    const url = `/api/analysis`;
    const params = queryParams ? `?${queryParams}` : "";
    return this.fetch<any>(`${url}${params}`);
  }

  async getReports(): Promise<any> {
    return this.fetch<any>(`/api/reports`);
  }

  async discoverCompetitors(hotelId: string): Promise<any> {
    return this.fetch<any>(`/api/v1/discovery/${hotelId}`);
  }

  async getLocations(): Promise<any[]> {
    return this.fetch<any[]>("/api/locations", { authenticated: false });
  }

  async exportReport(format: string = "csv"): Promise<void> {
    const token = await this.getToken();
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${LOCAL_API_URL}/api/reports/export?format=${format}`;
    const response = await fetch(url, {
      method: "POST",
      headers,
    });

    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    const timestamp = new Date().toISOString().split("T")[0];
    a.download = `report_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }

  async checkScheduledScan(
    force: boolean = false,
  ): Promise<{ triggered: boolean; session_id?: string; reason?: string }> {
    const params = force ? "?force=true" : "";
    return this.fetch<{
      triggered: boolean;
      session_id?: string;
      reason?: string;
    }>(`/api/trigger-scan${params}`, {
      method: "POST",
    });
  }

  async updateProfile(
    profile: {
      display_name?: string;
      company_name?: string;
      job_title?: string;
      phone?: string;
      avatar_url?: string;
      timezone?: string;
    },
  ): Promise<any> {
    return this.fetch<any>(`/api/profile`, {
      method: "PUT",
      body: JSON.stringify(profile),
    });
  }
  async getAdminStats(): Promise<AdminStats> {
    return this.fetch<AdminStats>("/api/admin/stats");
  }

  async getAdminFeed(limit: number = 50): Promise<any[]> {
    return this.fetch(`/api/admin/feed?limit=${limit}`);
  }

  async getAdminUsers(): Promise<any[]> {
    return this.fetch<any[]>("/api/admin/users");
  }

  async deleteAdminUser(userId: string): Promise<void> {
    return this.fetch<void>(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
  }

  async createAdminUser(data: any): Promise<any> {
    return this.fetch<any>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getAdminDirectory(limit = 100, city?: string): Promise<any[]> {
    const query = city ? `&city=${encodeURIComponent(city)}` : "";
    return this.fetch<any[]>(`/api/admin/directory?limit=${limit}${query}`);
  }

  async deleteAdminDirectory(entryId: string): Promise<void> {
    return this.fetch<void>(`/api/admin/directory/${entryId}`, {
      method: "DELETE",
    });
  }

  async getAdminLogs(limit = 50): Promise<any[]> {
    return this.fetch<any[]>(`/api/admin/logs?limit=${limit}`);
  }

  async getAdminScans(limit = 50): Promise<any[]> {
    return this.fetch<any[]>(`/api/admin/scans?limit=${limit}`);
  }

  // ===== Admin Edit Operations =====

  async getMarketIntelligence(
    city: string,
  ): Promise<MarketIntelligenceResponse> {
    const response = await this.fetch<MarketIntelligenceResponse>(
      `/api/admin/market-intelligence?city=${encodeURIComponent(city)}`,
    );
    return response;
  }

  async updateAdminUser(
    userId: string,
    updates: AdminUserUpdate,
  ): Promise<void> {
    return this.fetch<any>(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async updateAdminDirectory(entryId: string, updates: any): Promise<any> {
    return this.fetch<any>(`/api/admin/directory/${entryId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  // ===== Admin Hotels CRUD =====

  async getAdminHotels(limit = 100) {
    return this.fetch<any[]>(`/api/admin/hotels?limit=${limit}`);
  }

  async updateAdminHotel(hotelId: string, updates: any) {
    return this.fetch<any>(`/api/admin/hotels/${hotelId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  // User Hotel Update
  async updateHotel(hotelId: string, updates: any): Promise<any> {
    return this.fetch<any>(`/api/hotels/${hotelId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteAdminHotel(hotelId: string) {
    return this.fetch<any>(`/api/admin/hotels/${hotelId}`, {
      method: "DELETE",
    });
  }

  async getAdminSettings() {
    return this.fetch<any>(`/api/admin/settings`);
  }

  async updateAdminSettings(updates: any) {
    return this.fetch<any>(`/api/admin/settings`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  // Membership Plans
  async getAdminPlans() {
    return this.fetch<any[]>(`/api/admin/plans`);
  }

  async createAdminPlan(data: any) {
    return this.fetch<any>(`/api/admin/plans`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAdminPlan(id: string, data: any) {
    return this.fetch<any>(`/api/admin/plans/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteAdminPlan(id: string) {
    return this.fetch<void>(`/api/admin/plans/${id}`, {
      method: "DELETE",
    });
  }

  // ===== Admin API Keys =====

  async getAdminKeyStatus() {
    return this.fetch<any>("/api/admin/api-keys/status");
  }

  async rotateAdminKey() {
    return this.fetch<any>("/api/admin/api-keys/rotate", {
      method: "POST",
    });
  }

  async reloadAdminKeys() {
    return this.fetch<any>("/api/admin/api-keys/reload", {
      method: "POST",
    });
  }

  async resetAdminKeys() {
    return this.fetch<any>("/api/admin/api-keys/reset", {
      method: "POST",
    });
  }

  async getAdminScanDetails(id: string) {
    return this.fetch<any>(`/api/admin/scans/${id}`);
  }

  async getAdminProviders() {
    return this.fetch<any[]>("/api/admin/providers");
  }

  async getSchedulerQueue() {
    return this.fetch<any[]>("/api/admin/scheduler/queue");
  }

  async triggerAllOverdue() {
    return this.fetch<any>("/api/admin/scheduler/trigger-all", {
      method: "POST",
    });
  }

  async cleanupEmptyScans() {
    return this.fetch<any>("/api/admin/scans/cleanup-empty", {
      method: "DELETE",
    });
  }

  async generateReport(params: {
    hotel_ids: string[];
    period_months: number;
    comparison_mode: boolean;
    title: string;
  }) {
    return this.fetch<any>("/api/admin/reports/generate", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getAdminReports(): Promise<Report[]> {
    return this.fetch<Report[]>("/api/admin/reports");
  }

  async getSentimentHistory(hotelId: string, days: number = 30): Promise<any> {
    return this.fetch<any>(
      `/api/analysis/${hotelId}/sentiment-history?days=${days}`,
    );
  }

  // ===== Landing Page CMS (Kaizen) =====

  async getLandingConfig(locale: string = "tr"): Promise<Record<string, any>> {
    return this.fetch<Record<string, any>>(
      `/api/landing/config?locale=${locale}`,
      { authenticated: false },
    );
  }

  async getAdminLandingConfig(locale: string = "tr"): Promise<any[]> {
    return this.fetch<any[]>(`/api/admin/landing/config?locale=${locale}`);
  }

  async updateLandingConfig(configs: any[], locale: string = "tr"): Promise<void> {
    return this.fetch<void>("/api/admin/landing/config", {
      method: "PUT",
      body: JSON.stringify({ locale, configs }),
    });
  }

  async generateBriefing(params: {
    target_hotel_id: string;
    rival_hotel_id?: string;
    days?: number;
    report_type?: string;
  }): Promise<any> {
    return this.fetch<any>("/api/reports/briefing", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async exportBriefingPdf(
    target_hotel_id: string,
    rival_hotel_id?: string,
    days: number = 30,
    report_type: string = "Standard Comparison",
  ): Promise<void> {
    const token = await this.getToken();
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const params = new URLSearchParams({
      days: days.toString(),
      report_type,
    });
    if (rival_hotel_id) params.append("rival_hotel_id", rival_hotel_id);

    const url = `${LOCAL_API_URL}/api/reports/briefing/${target_hotel_id}/pdf?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) throw new Error("Briefing PDF Export failed");

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `briefing_${target_hotel_id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }

  async exportSavedBriefingPdf(reportId: string): Promise<void> {
    const token = await this.getToken();
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${LOCAL_API_URL}/api/reports/briefing/saved/${reportId}/pdf`;
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) throw new Error("Saved Briefing PDF Export failed");

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `briefing_saved_${reportId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }

  async getSavedBriefing(reportId: string): Promise<any> {
    return this.fetch<any>(`/api/reports/briefing/${reportId}`);
  }

  async getMarketForecast(city: string, days: number = 30): Promise<any[]> {
    return this.fetch<any[]>(`/api/market/forecast?city=${encodeURIComponent(city)}&days=${days}`);
  }

  async getMarketCities(): Promise<string[]> {
    return this.fetch<string[]>("/api/market/cities");
  }

  async getMarketEvents(city?: string): Promise<any[]> {
    const query = city ? `?city=${encodeURIComponent(city)}` : "";
    return this.fetch<any[]>(`/api/market/events${query}`);
  }

  async generateDispute(params: {
    hotel_id: string;
    ota_name: string;
    current_price: number;
    target_price: number;
    currency: string;
    language?: string;
  }): Promise<{ letter: string }> {
    return this.fetch<{ letter: string }>("/api/recovery/generate-dispute", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }
}

export const api = new ApiClient();
