"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SYNC_LOG_PAGE_SIZES } from "@/config/sync-logs";
import { cn } from "@/lib/utils";

interface SyncPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  itemLabel: string;
  isPending?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/**
 * Builds a compact page list: always the first and last page, plus a window
 * around the current one, with gaps collapsed into an ellipsis.
 */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - (sorted[index - 1] as number) > 1) result.push("gap");
    result.push(page);
  });

  return result;
}

export function SyncPagination({
  page,
  totalPages,
  total,
  pageSize,
  itemLabel,
  isPending,
  onPageChange,
  onPageSizeChange,
}: SyncPaginationProps) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? `No ${itemLabel}`
            : `${firstItem.toLocaleString()}-${lastItem.toLocaleString()} of ${total.toLocaleString()} ${itemLabel}`}
        </p>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYNC_LOG_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isPending}
        >
          <ChevronLeft className="size-4" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
        </Button>

        {pageWindow(page, totalPages).map((entry, index) =>
          entry === "gap" ? (
            <span
              key={`gap-${index}`}
              className="px-1 text-sm text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <Button
              key={entry}
              variant={entry === page ? "outline" : "ghost"}
              size="sm"
              className={cn("min-w-9", entry === page && "font-semibold")}
              onClick={() => onPageChange(entry)}
              disabled={isPending}
            >
              {entry}
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isPending}
        >
          <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
