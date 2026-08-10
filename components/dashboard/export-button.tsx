"use client";

import { IconDownload } from "@/components/icons";

export function ExportButton({
  filename,
  rows,
}: {
  filename: string;
  rows: (string | number | null | undefined)[][];
}) {
  const handleExport = () => {
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const s = cell === null || cell === undefined ? "" : String(cell);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors duration-150 hover:border-line hover:bg-hover hover:text-fg"
    >
      <IconDownload className="h-3.5 w-3.5" />
      خروجی CSV
    </button>
  );
}
