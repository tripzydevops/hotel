import {
  DashboardData,
  MonitorResult,
  Alert,
  QueryLog,
  AdminStats,
  AdminUser,
  AdminDirectoryEntry,
  DirectoryEntry,
  AdminLog,
  KeyStatus,
} from "@/types";

const isProduction = process.env.NODE_ENV === "production";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (isProduction ? "" : "http://localhost:8000");

class ApiClient {
  private async getToken(): Promise<string | null> {
    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || null;
    } catch (e) {
      console.error("[ApiClient] Error getting token:", e);
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
        errorMessage =
          errorData.detail ||
          errorData.message ||
          errorData.error ||
          errorMessage;
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

  async searchDirectory(query: string): Promise<any[]> {
    const url = `/api/v1/directory/search?q=${encodeURIComponent(query)}`;
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

  async getSessionLogs(sessionId: string): Promise<QueryLog[]> {
    return this.fetch<QueryLog[]>(`/api/sessions/${sessionId}/logs`);
  }

  async getAnalysis(userId: string, currency?: string): Promise<any> {
    const params = currency ? `?currency=${currency}` : "";
    return this.fetch<any>(`/api/analysis/${userId}${params}`);
  }

  async getAnalysisWithFilters(
    userId: string,
    queryParams: string,
  ): Promise<any> {
    const params = queryParams ? `?${queryParams}` : "";
    return this.fetch<any>(`/api/analysis/${userId}${params}`);
  }

  async getReports(userId: string): Promise<any> {
    return this.fetch<any>(`/api/reports/${userId}`);
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

  async getAdminDirectory(limit = 100): Promise<any[]> {
    return this.fetch<any[]>(`/api/admin/directory?limit=${limit}`);
  }

  async deleteAdminDirectory(entryId: number): Promise<void> {
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

  async updateAdminUser(userId: string, updates: any): Promise<any> {
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
}

export const api = new ApiClient();
