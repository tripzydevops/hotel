import { DashboardData, MonitorResult, Alert, QueryLog } from "@/types";

const isProduction = process.env.NODE_ENV === "production";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (isProduction ? "" : "http://localhost:8000");

class ApiClient {
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async getDashboard(userId: string): Promise<DashboardData> {
    return this.fetch<DashboardData>(`/api/dashboard/${userId}`);
  }

  async triggerMonitor(userId: string, options?: { check_in?: string; check_out?: string; adults?: number; currency?: string }): Promise<MonitorResult> {
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
    currency: string = "USD",
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
  async addHotelToDirectory(name: string, location: string, serpApiId?: string): Promise<void> {
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

  async getReports(userId: string): Promise<any> {
    return this.fetch<any>(`/api/reports/${userId}`);
  }

  async exportReport(userId: string, format: string = "csv"): Promise<void> {
    const url = `${API_BASE_URL}/api/reports/${userId}/export?format=${format}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `report_${userId}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }

  async checkScheduledScan(userId: string): Promise<{ triggered: boolean; session_id?: string; reason?: string }> {
    return this.fetch<{ triggered: boolean; session_id?: string; reason?: string }>(`/api/check-scheduled/${userId}`, {
      method: "POST",
    });
  }



  async updateProfile(userId: string, profile: {
    display_name?: string;
    company_name?: string;
    job_title?: string;
    phone?: string;
    avatar_url?: string;
    timezone?: string;
  }): Promise<any> {
    return this.fetch<any>(`/api/profile/${userId}`, {
      method: "PUT",
      body: JSON.stringify(profile),
    });
  }
  async getAdminStats(): Promise<any> {
    return this.fetch<any>("/api/admin/stats");
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

  // ===== Admin Edit Operations =====
  
  async updateAdminUser(userId: string, updates: any): Promise<any> {
    return this.fetch<any>(`/api/admin/users/${userId}`, {
      method: "PUT",
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

  async getAdminHotels(limit = 100): Promise<any[]> {
    return this.fetch<any[]>(`/api/admin/hotels?limit=${limit}`);
  }

  async updateAdminHotel(hotelId: string, updates: any): Promise<any> {
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

  async deleteAdminHotel(hotelId: string): Promise<void> {
    return this.fetch<void>(`/api/admin/hotels/${hotelId}`, {
      method: "DELETE",
    });
  }
}

export const api = new ApiClient();

