import type {
  AxisKey, CompanyProfile, DataStatus, DealInput, DealResults, PriceLookup, SavedDeal, SavedDealSummary, Sensitivity,
} from "@/lib/types";

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

async function send(path: string, options: RequestInit = {}): Promise<Response> {
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
  return response;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return (await send(path, options)).json();
}

export function calculateDeal(inputs: DealInput) {
  return request<DealResults>("/calculate", {
    method: "POST",
    body: JSON.stringify(inputs),
  });
}

export function calculateSensitivity(inputs: DealInput, xAxis: AxisKey, yAxis: AxisKey) {
  return request<Sensitivity>("/sensitivity", {
    method: "POST",
    body: JSON.stringify({ inputs, x_axis: xAxis, y_axis: yAxis }),
  });
}

/** Downloads the model as an Excel file. */
export async function downloadExcel(name: string, inputs: DealInput, xAxis: AxisKey, yAxis: AxisKey) {
  const response = await send("/export", {
    method: "POST",
    body: JSON.stringify({ name, inputs, x_axis: xAxis, y_axis: yAxis }),
  });
  const blob = await response.blob();
  const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = match?.[1] ?? "Deal.xlsx";
  link.click();
  URL.revokeObjectURL(link.href);
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

// ---------------------------------------------------------------- Company data

export function getDataStatus() {
  return request<DataStatus>("/company-data/status");
}

export function getCompany(ticker: string) {
  return request<CompanyProfile>(`/company/${encodeURIComponent(ticker.trim())}`);
}

/** Latest close, plus the last close before the announcement date. */
export function getPrices(ticker: string, announced: string) {
  const query = announced ? `?announced=${encodeURIComponent(announced)}` : "";
  return request<PriceLookup>(`/price/${encodeURIComponent(ticker.trim())}${query}`);
}
