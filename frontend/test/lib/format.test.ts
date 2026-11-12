import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  currencySymbol,
  formatCountdown,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  initials,
  toDateTimeLocalValue,
} from "@/lib/format";
import { cn } from "@/lib/cn";
import { isRenderableImageSrc } from "@/lib/image";

// Intl uses non-breaking spaces in some locales; compare on plain spaces.
const plain = (s: string) => s.replace(/\s/g, " ");

const NOW = new Date("2026-11-10T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const ahead = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("currency", () => {
  it("follows the locale", () => {
    expect(plain(formatCurrency(1234.5, "pt-BR"))).toBe("R$ 1.234,50");
    expect(formatCurrency(1234.5, "en-US")).toBe("$1,234.50");
    expect(currencySymbol("pt-BR")).toBe("R$");
    expect(currencySymbol("en-US")).toBe("$");
  });

  it("drops cents on whole amounts", () => {
    expect(formatCurrency(80, "en-US")).toBe("$80");
    expect(plain(formatCurrency(80, "pt-BR"))).toBe("R$ 80");
  });
});

describe("dates", () => {
  it("formats a date for the locale", () => {
    expect(formatDate("2026-03-05T12:00:00Z", "en-US")).toBe("Mar 5, 2026");
  });

  it("builds a datetime-local value in local time, zero-padded", () => {
    expect(toDateTimeLocalValue(new Date("2026-03-05T07:08:00Z"))).toBe("2026-03-05T07:08");
  });
});

describe("relative times", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [20_000, "just now"],
    [5 * MIN, "5m ago"],
    [3 * HOUR, "3h ago"],
    [2 * DAY, "2d ago"],
  ])("formats %sms ago", (ms, expected) => {
    expect(formatRelativeTime(ago(ms), "en-US")).toBe(expected);
  });

  it("uses the locale's words", () => {
    expect(formatRelativeTime(ago(20_000), "pt-BR")).not.toBe("just now");
  });

  it.each([
    [-MIN, "Ended"],
    [0, "Ended"],
    [2 * DAY + 3 * HOUR + 10 * MIN, "2d 3h left"],
    [4 * HOUR + 15 * MIN, "4h 15m left"],
    [9 * MIN + 59_000, "9m left"],
  ])("counts down %sms", (ms, expected) => {
    expect(formatCountdown(ahead(ms), "en-US")).toBe(expected);
  });
});

describe("initials", () => {
  it.each([
    ["Ana Souza", "AS"],
    ["ana maria souza", "AM"],
    ["Bruno", "B"],
    ["  Carla  Dias ", "CD"],
  ])("%s → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });
});

describe("isRenderableImageSrc", () => {
  it.each([
    ["data:image/jpeg;base64,xx", true],
    ["https://cdn.example.com/a.jpg", true],
    ["http://localhost/a.jpg", true],
    ["seed-bike.jpg", false],
    ["data:text/html,<script>", false],
    ["javascript:alert(1)", false],
    [undefined, false],
    ["", false],
  ])("%s → %s", (src, expected) => {
    expect(isRenderableImageSrc(src)).toBe(expected);
  });
});
