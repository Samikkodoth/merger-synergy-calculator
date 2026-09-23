"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Status = "checking" | "online" | "offline";

const DOT_COLORS: Record<Status, string> = {
  checking: "bg-ink-soft",
  online: "bg-gain",
  offline: "bg-loss",
};

const LABELS: Record<Status, string> = {
  checking: "Connecting to the calculator",
  online: "Calculator connected",
  offline: "Calculator offline",
};

export default function ApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    fetch(`${API_URL}/`)
      .then((response) => setStatus(response.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rule bg-white px-3 py-1 text-caption text-ink-soft">
      <span className={`h-2 w-2 rounded-full ${DOT_COLORS[status]}`} aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}