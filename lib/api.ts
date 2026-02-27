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

const isProduction = process.env.NODE_ENV === "production";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (isProduction ? "" : "http://localhost:8000");

class ApiClient {
  public readonly baseURL = API_BASE_URL;
  private supabase: any = null;

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
      // EXPLANATION: Auth Session Retrieval (Singleton Pattern)
      // We use a singleton instance of the browser client to maintain session 
      // hydration and prevent race conditions on Vercel/SSR environments.
      if (!this.supabase) {
        const { createClient } = await import("@/utils/supabase/client");
        this.supabase = createClient();
      }
      
      let { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.warn("[ApiClient] Auth session error:", error);
        return null;
      }
      
      let token = session?.access_token || null;
      
      // EXPLANATION: Hydration Guard
      // If we have no token, check if a user exists. If user exists but no session,
      // it might be a hydration lag. We wait briefly and retry once.
      if (!token) {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (user) {
          console.log("[ApiClient] User found but no session. Retrying in 500ms...");
          await new Promise(resolve => setTimeout(resolve, 500));
          const retry = await this.supabase.auth.getSession();
          token = retry.data.session?.access_token || null;
          if (token) {
            console.log("[ApiClient] Session recovered after retry.");
          } else {
            console.warn("[ApiClient] Session still missing after retry for user:", user.id);
          }
        }
      }
      
      return token;
    } catch (e) {
      console.error("[ApiClient] Unexpected error getting token:", e);
      return null;
    }
  }


  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Get session token safely
    const token = await this.getToken();
    if (!token) {
      console.log("[ApiClient] No token found in session");
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options?.headers,
    };

    if (token) {
      (headers as any)["Authorization"] = `Bearer ${token}`;
    } else {
      console.warn(`[ApiClient] Sending request to ${endpoint} WITHOUT token`);
    }

    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log(`[ApiClient] Fetching from ${API_BASE_URL}: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      ...options,
      cache: "no-store",
      headers,
    });

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

  async getDashboard(userId: string): Promise<DashboardData> {
    return this.fetch<DashboardData>(`/api/dashboard/${userId}`);
  }

  async triggerMonitor(
    userId: string,
    options?: {
      check_in?: string;
      check_out?: string;
      adults?: number;
      currency?: string;
    },
  ): Promise<MonitorResult> {
    return this.fetch<MonitorResult>(`/api/monitor/${userId}`, {
      method: "POST",
      body: options ? JSON.stringify(options) : undefined,
    });
  }

  async getAlerts(userId: string, unreadOnly = false): Promise<Alert[]> {
    return this.fetch<Alert[]>(
      `/api/alerts/${userId}?unread_only=${unreadOnly}`,
    );
  }

  async markAlertRead(alertId: string): Promise<void> {
    return this.fetch<void>(`/api/alerts/${alertId}/read`, {
      method: "PATCH",
    });
  }

  async clearAlerts(userId: string): Promise<void> {
    return this.fetch<void>(`/api/alerts/user/${userId}`, {
      method: "DELETE",
    });
  }

  async deleteAlert(alertId: string): Promise<void> {
    return this.fetch<void>(`/api/alerts/${alertId}`, {
      method: "DELETE",
    });
  }

  async addHotel(
    userId: string,
    name: string,
    location: string,
    isTarget: boolean,
    currency: string = "TRY",
    serpApiId?: string,
  ): Promise<void> {
    return this.fetch<void>(`/api/hotels/${userId}`, {
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

  async updateSettings(userId: string, settings: any): Promise<void> {
    return this.fetch<void>(`/api/settings/${userId}`, {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  async getSettings(userId: string): Promise<any> {
    return this.fetch<any>(`/api/settings/${userId}`);
  }

  async getProfile(userId: string): Promise<any> {
    return this.fetch<any>(`/api/profile/${userId}`);
  }

  async searchDirectory(query: string, city?: string): Promise<any[]> {
    // EXPLANATION: Parameterized Search
    // Updated to support an optional city filter in the query string.
    let url = `/api/v1/directory/search?q=${encodeURIComponent(query)}`;
    if (city) {
      url += `&city=${encodeURIComponent(city)}`;
    }
    console.log("[API] Searching:", url);
    return this.fetch<any[]>(url);
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

  async getAnalysis(userId: string, currency?: string): Promise<any> {
    // EXPLANATION: Explicit Path Separation
    // We separate the base path from query parameters to ensure that
    // route contract tests can accurately match the endpoint. 
    // This prevents "No Data" screens caused by malformed URL concatenations.
    const url = `/api/analysis/${userId}`;
    const params = currency ? `?currency=${currency}` : "";
    return this.fetch<any>(`${url}${params}`);
  }

  async getAnalysisWithFilters(
    userId: string,
    queryParams: string,
  ): Promise<any> {
    const url = `/api/analysis/${userId}`;
    const params = queryParams ? `?${queryParams}` : "";
    return this.fetch<any>(`${url}${params}`);
  }

  async getReports(userId: string): Promise<any> {
    return this.fetch<any>(`/api/reports/${userId}`);
  }

  async discoverCompetitors(hotelId: string): Promise<any> {
    return this.fetch<any>(`/api/v1/discovery/${hotelId}`);
  }

  async getLocations(): Promise<any[]> {
    return this.fetch<any[]>("/api/locations");
  }

  async exportReport(userId: string, format: string = "csv"): Promise<void> {
    const token = await this.getToken();
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${API_BASE_URL}/api/reports/${userId}/export?format=${format}`;
    const response = await fetch(url, {
      method: "POST",
      headers,
    });

    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `report_${userId}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }

  async checkScheduledScan(
    userId: string,
    force: boolean = false,
  ): Promise<{ triggered: boolean; session_id?: string; reason?: string }> {
    const params = force ? "?force=true" : "";
    return this.fetch<{
      triggered: boolean;
      session_id?: string;
      reason?: string;
    }>(`/api/trigger-scan/${userId}${params}`, {
      method: "POST",
    });
  }

  async updateProfile(
    userId: string,
    profile: {
      display_name?: string;
      company_name?: string;
      job_title?: string;
      phone?: string;
      avatar_url?: string;
      timezone?: string;
    },
  ): Promise<any> {
    return this.fetch<any>(`/api/profile/${userId}`, {
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
    return this.fetch<Record<string, any>>(`/api/landing/config?locale=${locale}`);
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

    const url = `${API_BASE_URL}/api/reports/briefing/${target_hotel_id}/pdf?${params.toString()}`;
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

    const url = `${API_BASE_URL}/api/reports/briefing/saved/${reportId}/pdf`;
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
}

export const api = new ApiClient();
