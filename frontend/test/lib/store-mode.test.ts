import { describe, expect, it } from "vitest";
import { safeNext, storeHref } from "@/lib/store-mode";

describe("safeNext", () => {
  it("allows same-origin paths", () => {
    expect(safeNext("/listing/1")).toBe("/listing/1");
    expect(safeNext("/orders?chat=2")).toBe("/orders?chat=2");
  });

  it.each([
    ["an absolute URL", "https://evil.example/phish"],
    ["a protocol-relative URL", "//evil.example"],
    ["a relative path", "listing/1"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["nothing", undefined],
    ["null", null],
    ["an empty string", ""],
  ])("rejects %s", (_label, value) => {
    expect(safeNext(value)).toBeNull();
  });
});

describe("storeHref", () => {
  it("links to the store page", () => {
    expect(storeHref("abc")).toBe("/stores/abc");
  });
});
