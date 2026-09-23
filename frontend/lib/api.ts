import type { DealInput, DealResults, SavedDeal, SavedDealSummary, Sensitivity } from "@/lib/types";

const configuredUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
export const API_URL = configuredUrl.endsWith("/") ? configuredUrl.slice(0, -1) : configuredUrl;

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") {
      return data.detail;
    }
  } catch {
    // The response wasn't JSON, so we use the generic message below
  }
  return "Some inputs are invalid. Check for negative numbers or percentages above 100%.";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new Error("Could not reach the API. Is the backend server running?");
  }

  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export function calculateDeal(inputs: DealInput) {
  return request<DealResults>("/calculate", {
    method: "POST",
    body: JSON.stringify(inputs),
  });
}

export function saveDeal(name: string, inputs: DealInput) {
  return request<SavedDealSummary>("/deals", {
    method: "POST",
    body: JSON.stringify({ name, inputs }),
  });
}

export function listDeals() {
  return request<SavedDealSummary[]>("/deals");
}

export function getDeal(id: number) {
  return request<SavedDeal>(`/deals/${id}`);
}

export function deleteDeal(id: number) {
  return request<{ deleted: number }>(`/deals/${id}`, { method: "DELETE" });
}

export function calculateSensitivity(inputs: DealInput) {
  return request<Sensitivity>("/sensitivity", {
    method: "POST",
    body: JSON.stringify(inputs),
  });
}