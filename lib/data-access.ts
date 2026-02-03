import { DashboardData, UserSettings } from "@/types";

const isProduction = process.env.NODE_ENV === "production";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchWithToken<T>(endpoint: string, token: string): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`[DataAccess] Fetching: ${url}`);
  
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store", // Ensure fresh data for the dashboard
  });

  if (!res.ok) {
     const errorText = await res.text();
     console.error(`[DataAccess] Error fetching ${url}: ${res.status} ${errorText}`);
     throw new Error(`Failed to fetch ${endpoint}: ${res.statusText}`);
  }
  return res.json();
}

export async function getDashboardServer(userId: string, token: string): Promise<DashboardData> {
  return fetchWithToken<DashboardData>(`/api/dashboard/${userId}`, token);
}

export async function getSettingsServer(userId: string, token: string): Promise<UserSettings> {
  return fetchWithToken<UserSettings>(`/api/settings/${userId}`, token);
}

export async function getProfileServer(userId: string, token: string): Promise<any> {
    return fetchWithToken<any>(`/api/profile/${userId}`, token);
}
