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
  AdminSettings,
  AdminScan,
  HealthMetrics,
  SystemLogEntry,
  SystemLogsResponse,
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

export const API_BASE_URL = isProduction
  ? ''
  : 'http://localhost:8000';

class ApiClient {
  public readonly baseURL = API_BASE_URL;
  private insforgeInstance: any = null;
  private inflightSessionPromise: Promise<any> | null = null;

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

  /**
   * Retrieves the current authentication token from the SDK.
   * PERFORMANCE: Memoizes the import and uses an inflight promise to 'lock'
   * session checks. This prevents 401 errors caused by concurrent session
   * initialization race conditions.
   */
  private async getToken(forceRefresh = false): Promise<string | null> {
    try {
      // 1. Memoized Import
      if (!this.insforgeInstance) {
        const { insforge } = await import("@/lib/insforge");
        this.insforgeInstance = insforge;
      }

      // 2. Session Lock (Single Inflight Promise)
      // If a check is already underway, await the same promise.
      if (!this.inflightSessionPromise || forceRefresh) {
        // Use refreshSession() as it correctly triggers background token refresh
        this.inflightSessionPromise = this.insforgeInstance.auth.refreshSession()
          .finally(() => {
            this.inflightSessionPromise = null;
          });
      }
      
      const { data } = await this.inflightSessionPromise;
      
      // Prefer token from the refreshSession result
      if (data?.accessToken) {
        return data.accessToken;
      }

      // 3. Fallback: Check headers directly if session result is valid
      const headers = this.insforgeInstance.getHttpClient().getHeaders();
      const authHeader = (headers as any)["Authorization"];
      return authHeader ? authHeader.replace("Bearer ", "") : null;
    } catch (e) {
      console.error("[ApiClient] Unexpected error getting token:", e);
      return null;
    }
  }

  public async getAccessToken(): Promise<string | null> {
    return this.getToken();
  }



  private async fetch<T>(
    endpoint: string,
    options?: RequestInit & { authenticated?: boolean },
    retryCount = 0
  ): Promise<T> {
    const shouldAuthenticate = options?.authenticated !== false;

    // Get session token safely
    const token = shouldAuthenticate ? await this.getToken(retryCount > 0) : null;
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options?.headers,
    };

    if (token) {
      (headers as any)["Authorization"] = `Bearer ${token}`;
    } else if (shouldAuthenticate) {
      console.warn(`[ApiClient] [AUTH_MISSING] ${endpoint}`);
    }

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const impersonateFromUrl = urlParams.get("impersonate");
      if (impersonateFromUrl) {
        window.sessionStorage.setItem("impersonate_user_id", impersonateFromUrl);
      }

      const impersonateId = window.sessionStorage.getItem("impersonate_user_id");
      if (impersonateId) {
        (headers as any)["x-impersonate-user-id"] = impersonateId;
      }
    }

    const fullUrl = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(fullUrl, {
      ...options,
      cache: "no-store",
      headers,
    });

    // Handle session expiration with a single retry
    if (response.status === 401 && shouldAuthenticate && retryCount < 1) {
      console.log(`[ApiClient] [401_RETRY] ${endpoint}`);
      return this.fetch<T>(endpoint, options, retryCount + 1);
    }

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

  async getDashboard(): Promise<DashboardData> {
    return this.fetch<DashboardData>(`/api/dashboard`);
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

  async getProfile(): Promise<any> {
    const profile = await this.fetch<any>(`/api/profile`);
    console.log("[API] Profile loaded:", profile?.display_name, profile?.plan_type);
    return profile;
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
    return this.fetch<{ synced_count: number }>(`/api/admin/sync`, { method: "POST" });
  }

  async syncProfiles(): Promise<{ synced_count: number }> {
    return this.fetch<{ synced_count: number }>(`/api/admin/sync/profiles`, { method: "POST" });
  }

  async syncAll(): Promise<{ directory: any; profiles: any }> {
    return this.fetch<{ directory: any; profiles: any }>(`/api/admin/sync/all`, { method: "POST" });
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

  /**
   * Ghost Competitor Discovery — Semantic Vector Search.
   * Automatically suggests the most semantically similar hotels to the target
   * hotel using pgvector cosine similarity (B2B Cold Start Solver).
   * Called automatically when a hotel has < 2 configured competitors.
   */
  async discoverGhostCompetitors(hotelId: string, limit = 5): Promise<any[]> {
    return this.fetch<any[]>(`/api/v1/discovery/${hotelId}/semantic?limit=${limit}`);
  }

  /**
   * Batch signal ingestion — B2B product intelligence telemetry.
   * Called by useSignalBuffer to flush buffered competitor interaction signals.
   * Used by the CompsetIntelligenceAgent to build competitor attention profiles.
   */
  async batchSignals(payload: { session_id: string; signals: unknown[] }): Promise<any> {
    return this.fetch<any>('/api/signals/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ===== Feature 7.5 — What-If Scenario Modeling =====

  async simulateWhatIf(hotelId: string, scenario: string): Promise<any> {
    return this.fetch<any>('/api/v1/analysis/whatif', {
      method: 'POST',
      body: JSON.stringify({ hotel_id: hotelId, scenario }),
    });
  }

  // ===== Feature 7.2 — Revenue Impact from Sentiment =====

  async getRevenueImpact(hotelId: string): Promise<any> {
    return this.fetch<any>(`/api/v1/analysis/revenue-impact/${hotelId}`);
  }

  // ===== Feature 7.3 — Proactive Alert Evaluation =====

  async evaluateProactiveAlerts(hotelId: string): Promise<any> {
    return this.fetch<any>(`/api/v1/alerts/evaluate/${hotelId}`, { method: 'POST' });
  }

  // ===== Feature 7.6 — Collaborative Annotations =====

  async getAnnotations(hotelId: string): Promise<any[]> {
    return this.fetch<any[]>(`/api/v1/hotels/${hotelId}/annotations`);
  }

  async addAnnotation(hotelId: string, note: string, annotationType = 'general'): Promise<any> {
    return this.fetch<any>(`/api/v1/hotels/${hotelId}/annotations`, {
      method: 'POST',
      body: JSON.stringify({ note, annotation_type: annotationType }),
    });
  }

  async deleteAnnotation(hotelId: string, annotationId: string): Promise<any> {
    return this.fetch<any>(`/api/v1/hotels/${hotelId}/annotations/${annotationId}`, {
      method: 'DELETE',
    });
  }

  async generateMeetingPrep(hotelId: string): Promise<any> {
    return this.fetch<any>(`/api/v1/hotels/${hotelId}/annotations/meeting-prep`, {
      method: 'POST',
    });
  }


  async getIntelligenceBrief(hotelId: string, locale?: string): Promise<any> {
    const params = locale ? `?locale=${locale}` : "";
    return this.fetch<any>(`/api/v1/analysis/intelligence-brief/${hotelId}${params}`);
  }

  async getLocations(): Promise<any[]> {
    return this.fetch<any[]>("/api/locations", { authenticated: false });
  }

  async exportReport(format: string = "csv"): Promise<void> {
    const token = await this.getToken();
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${API_BASE_URL}/api/reports/export?format=${format}`;
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


  async updateProfile(profile: {
    display_name?: string;
    company_name?: string;
    job_title?: string;
    phone?: string;
    avatar_url?: string;
    timezone?: string;
  }): Promise<any> {
    console.log("[API] Updating profile with:", Object.keys(profile));
    const result = await this.fetch<any>(`/api/profile`, {
      method: "PUT",
      body: JSON.stringify(profile),
    });
    console.log("[API] Profile update response:", result?.display_name);
    return result;
  }
  async getAdminStats(): Promise<AdminStats> {
    return this.fetch<AdminStats>("/api/admin/stats");
  }

  async getAdminFeed(limit: number = 50): Promise<any[]> {
    return this.fetch(`/api/admin/feed?limit=${limit}`);
  }

  async getAdminUsers(q?: string): Promise<any[]> {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    return this.fetch<any[]>(`/api/admin/users${query}`);
  }

  async terminateImpersonation(): Promise<void> {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("impersonate_user_id");
    }
    return this.fetch<void>("/api/admin/terminate-impersonation", {
      method: "POST",
    });
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

  async getSystemLogs(limit = 100): Promise<SystemLogsResponse> {
    return this.fetch<SystemLogsResponse>(`/api/admin/system-logs?limit=${limit}`);
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

  async getAdminSettings(): Promise<AdminSettings> {
    return this.fetch<AdminSettings>(`/api/admin/settings`);
  }

  async updateAdminSettings(updates: Partial<AdminSettings>): Promise<AdminSettings> {
    return this.fetch<AdminSettings>(`/api/admin/settings`, {
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

  async checkScheduledScan(force: boolean = false) {
    // Standard users use this for one-off checks, admins use it to wake scheduler.
    // Maps to the global trigger for simplicity in this version.
    return this.triggerAllOverdue();
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
    locale?: string;
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
    locale?: string,
  ): Promise<void> {
    const token = await this.getToken();
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const params = new URLSearchParams({
      days: days.toString(),
      report_type,
    });
    if (rival_hotel_id) params.append("rival_hotel_id", rival_hotel_id);
    if (locale) params.append("locale", locale);

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

    const url = `${this.baseURL}/api/reports/briefing/saved/${reportId}/pdf`;
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

  async getMarketForecast(city: string, days: number = 30, language?: string): Promise<any> {
    let url = `/api/market/forecast?city=${encodeURIComponent(city)}&days=${days}`;
    if (language) url += `&language=${encodeURIComponent(language)}`;
    return this.fetch<any>(url);
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

  async getAllApiKeys(): Promise<any[]> {
    return this.fetch<any[]>("/api/admin/keys");
  }

  async deleteApiKey(keyId: string): Promise<void> {
    return this.fetch<void>(`/api/admin/keys/${keyId}`, {
      method: "DELETE",
    });
  }

  // ===== Batch monitoring (Stitch) =====

  async getAdminBatches(limit = 50) {
    return this.fetch<any[]>(`/api/admin/batches?limit=${limit}`);
  }

  async getAdminBatchDetails(batchId: string) {
    return this.fetch<any>(`/api/admin/batches/${batchId}`);
  }

  async rescanBatchTask(taskId: string) {
    return this.fetch<any>(`/api/admin/tasks/${taskId}/rescan`, {
      method: "POST",
    });
  }

  async getAdminHeartbeats(): Promise<HealthMetrics> {
    return this.fetch<HealthMetrics>("/api/admin/heartbeats");
  }

  async exportAdminScan(scanId: string): Promise<Blob> {
    const token = await this.getToken();
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${API_BASE_URL}/api/admin/scans/${scanId}/export`;
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) throw new Error("CSV Export failed");
    return response.blob();
  }

  async exportAdminScanCsv(scanId: string): Promise<void> {
    const token = await this.getToken();
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${API_BASE_URL}/api/admin/scans/${scanId}/export`;
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) throw new Error("CSV Export failed");

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `scan_${scanId}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }

  // ===== AI Copilot Chat =====

  async copilotChat(
    message: string,
    history: Array<{ role: string; content: string }>,
    screenContext: Record<string, unknown>,
  ): Promise<{ reply: string; tool_calls?: Array<{ name: string; label?: string }> }> {
    return this.fetch('/api/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        history,
        screen_context: screenContext,
      }),
    });
  }

  // ── GDPR / DSAR Compliance ──────────────────────────────────────────────

  async exportProfileData(): Promise<any> {
    return this.fetch<any>(`/api/profile/dsar/export`);
  }

  async purgeProfileData(): Promise<any> {
    return this.fetch<any>(`/api/profile/dsar/purge`, {
      method: "DELETE",
    });
  }

  async recordConsent(accepted: boolean): Promise<void> {
    return this.fetch<void>(`/api/profile/consent`, {
      method: "POST",
      body: JSON.stringify({ accepted }),
    });
  }

  // ── Compliance Document Center ──────────────────────────────────────────

  async getComplianceDocuments(): Promise<Array<{ id: string; title: string; format: string }>> {
    return this.fetch<Array<{ id: string; title: string; format: string }>>(`/api/admin/compliance/documents`);
  }

  async getComplianceDocument(id: string): Promise<{ id: string; title: string; content: string; format: string }> {
    return this.fetch<{ id: string; title: string; content: string; format: string }>(`/api/admin/compliance/documents/${id}`);
  }

  async runSecurityAudit(): Promise<{ timestamp: string; status: string; checks: Array<{ name: string; description: string; status: string; details: any }> }> {
    return this.fetch<{ timestamp: string; status: string; checks: Array<{ name: string; description: string; status: string; details: any }> }>(`/api/admin/compliance/security-audit`);
  }

  async exportSecurityLogs(): Promise<void> {
    const token = await this.getToken();
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${API_BASE_URL}/api/admin/compliance/logs/export`;
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) throw new Error("Security logs export failed");

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `system_audit_trail_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }

  async getVerbisDraft(): Promise<any> {
    return this.fetch<any>(`/api/admin/compliance/verbis-draft`);
  }

  async verifyMfaCode(token: string, code: string): Promise<any> {
    return this.fetch<any>(`/api/auth/mfa/verify`, {
      method: "POST",
      body: JSON.stringify({ token, code }),
    });
  }
}

export const api = new ApiClient();
