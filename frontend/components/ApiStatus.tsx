"use client";

import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

export default function ApiStatus() {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    fetch(`${API_URL}/`)
      .then((response) => response.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("Could not reach the API. Is the backend server running?"));
  }, []);

  return (
    <p className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700">
      Backend status: {status}
    </p>
  );
}