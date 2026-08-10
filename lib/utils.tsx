import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function fetcher<JSON = any>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<JSON> {
  const response = await fetch(input, { ...init, cache: "no-store" });

  return response.json();
}

export const capitalize = (s: string) => {
  if (typeof s !== "string") return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const capitalizeFirstLetterAndReoplaceUnderscore = (s: string) => {
  if (typeof s !== "string") return "";
  return s.replaceAll("_", " ").charAt(0).toUpperCase() + s.replaceAll("_", " ").slice(1).toLowerCase();
};

export const truncate = (str: string, num: number) => {
  if (!str) return "";
  if (str.length <= num) {
    return str;
  }
  return str.slice(0, num) + "...";
};

export const toDateString = (date: Date) => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** Format date with ordinal day, e.g. "7th February 2026" */
export function formatOrdinalDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDate();
  const ordinal =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  const year = d.getFullYear();
  return `${day}${ordinal} ${month} ${year}`;
}

/**
 * Each step converts the running value into the next unit up, so the divisor
 * on a row is what turns that row's unit into the following one: 60 seconds to
 * a minute, 60 minutes to an hour, and so on. The last entry never divides.
 */
const TIME_AGO_UNITS: ReadonlyArray<{ perNext: number; unit: string }> = [
  { perNext: 60, unit: "second" },
  { perNext: 60, unit: "minute" },
  { perNext: 24, unit: "hour" },
  { perNext: 7, unit: "day" },
  { perNext: 4.35, unit: "week" },
  { perNext: 12, unit: "month" },
  { perNext: Number.POSITIVE_INFINITY, unit: "year" },
];

/** Renders a past timestamp as "3 minutes ago" / "2 weeks ago". */
export function formatTimeAgo(date: Date | string | number): string {
  let value = (Date.now() - new Date(date).getTime()) / 1000;
  if (value < 60) return "just now";

  for (const { perNext, unit } of TIME_AGO_UNITS) {
    if (value < perNext) {
      const rounded = Math.round(value);
      return `${rounded} ${unit}${rounded === 1 ? "" : "s"} ago`;
    }
    value = value / perNext;
  }

  return "a long time ago";
}

export const random = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

export const usNumberformatter = (number: number, decimals = 0) =>
  Intl.NumberFormat("us", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(Number(number))
    .toString();

export const percentageFormatter = (number: number, decimals = 1) => {
  const formattedNumber = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number);
  const symbol = number > 0 && number !== Infinity ? "+" : "";

  return `${symbol}${formattedNumber}`;
};

export const millionFormatter = (number: number, decimals = 1) => {
  const formattedNumber = new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number);
  return `${formattedNumber}M`;
};
export const formatters: { [key: string]: any } = {
  currency: (number: number, currency: string = "USD") =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(number),
  unit: (number: number) => `${usNumberformatter(number)}`,
};

// Tremor Raw focusInput [v0.0.1]

export const focusInput = [
  // base
  "focus:ring-1 focus:outline-0 focus:border-grey",
  // ring color
  "focus:ring-darkgrey",
];

// Tremor Raw focusRing [v0.0.1]

export const focusRing = [
  // base
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  // outline color
  "outline-darkgrey",
];

// Tremor Raw hasErrorInput [v0.0.1]

export const hasErrorInput = [
  // base
  "ring-2",
  // border color
  "border-danger",
  // ring color
  "ring-danger/50",
];

export const highlightMatch = (text: string, search: string) => {
  if (!search) return text;
  const parts = text.split(new RegExp(`(${search})`, "gi"));
  return parts.map((part, index) => 
    part.toLowerCase() === search.toLowerCase() 
      ? <mark key={index} className="bg-primary/20">{part}</mark>
      : part
  );
};