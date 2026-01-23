import { DashboardData, MonitorResult, Alert } from "@/types";

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

  async triggerMonitor(userId: string): Promise<MonitorResult> {
    return this.fetch<MonitorResult>(`/api/monitor/${userId}`, {
      method: "POST",
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
  ): Promise<void> {
    return this.fetch<void>(`/api/hotels/${userId}`, {
      method: "POST",
      body: JSON.stringify({
        name,
        location,
        is_target_hotel: isTarget,
        preferred_currency: currency,
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
}

export const api = new ApiClient();
