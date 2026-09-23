"use client";

import { useState } from "react";

type SaveDealBoxProps = {
  onSave: (name: string) => void;
  isSaving: boolean;
};

export default function SaveDealBox({ onSave, isSaving }: SaveDealBoxProps) {
  const [name, setName] = useState("");
  const trimmedName = name.trim();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-5 sm:flex-row sm:items-end">
      <label className="block flex-1 text-sm">
        <span className="text-gray-600">Deal name</span>
        <input
          type="text"
          value={name}
          maxLength={200}
          placeholder="e.g. Acme buys Beta Corp"
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none"
        />
      </label>
      <button
        type="button"
        onClick={() => onSave(trimmedName)}
        disabled={isSaving || trimmedName === ""}
        className="cursor-pointer rounded-md bg-gray-900 px-5 py-2.5 font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save deal"}
      </button>
    </div>
  );
}