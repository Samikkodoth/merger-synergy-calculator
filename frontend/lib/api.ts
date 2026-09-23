import type { DealInput, DealResults } from "@/lib/types";

export const API_URL = "http://127.0.0.1:8000";

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