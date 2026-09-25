import type { Issue } from "@/lib/types";

const STYLES: Record<Issue["level"], { box: string; label: string }> = {
  error: { box: "border-loss/30 bg-loss/5 text-loss", label: "Needs fixing" },
  warning: { box: "border-brass/50 bg-brass/10 text-ink", label: "Check" },
  note: { box: "border-rule bg-white text-ink-soft", label: "Note" },
};

/** Errors, warnings and notes from the model, most serious first. */
export default function IssuesList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  const order = { error: 0, warning: 1, note: 2 };
  const sorted = [...issues].sort((a, b) => order[a.level] - order[b.level]);

  return (
    <ul className="space-y-2" aria-label="Messages about this deal">
      {sorted.map((issue) => (
        <li
          key={issue.code}
          role={issue.level === "error" ? "alert" : undefined}
          className={`rounded-md border px-4 py-3 text-body ${STYLES[issue.level].box}`}
        >
          <span className="font-semibold">{STYLES[issue.level].label}: </span>
          {issue.message}
        </li>
      ))}
    </ul>
  );
}
