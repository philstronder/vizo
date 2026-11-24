import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ListingFilters } from "@/components/listings/ListingFilters";
import type { ListingFilters as Filters } from "@/types";
import { renderWithProviders } from "../render";

// Holds the filters like MarketplaceFeed does, and reports every change.
function Harness({ initial, onChange }: { initial: Filters; onChange: (f: Filters) => void }) {
  const [filters, setFilters] = useState(initial);
  return (
    <ListingFilters
      filters={filters}
      onChange={(next) => {
        setFilters(next);
        onChange(next);
      }}
    />
  );
}

function setup(initial: Filters = { type: "all" }, locale?: "pt-BR" | "en-US") {
  const onChange = vi.fn();
  renderWithProviders(<Harness initial={initial} onChange={onChange} />, { locale });
  const lastFilters = (): Filters => onChange.mock.lastCall![0];
  return { onChange, lastFilters };
}

describe("ListingFilters price range", () => {
  it("shows empty min and max fields with the currency symbol, not a slider", () => {
    setup();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    const min = screen.getByRole("spinbutton", { name: "Minimum price" });
    const max = screen.getByRole("spinbutton", { name: "Maximum price" });
    expect(min).toHaveValue(null);
    expect(max).toHaveValue(null);
    expect(min).toHaveAttribute("placeholder", "Min");
    expect(max).toHaveAttribute("placeholder", "Max");
    expect(screen.getAllByText("$")).toHaveLength(2);
  });

  it("sets a minimum price on its own", async () => {
    const { lastFilters } = setup();
    await userEvent.type(screen.getByRole("spinbutton", { name: "Minimum price" }), "150");
    expect(lastFilters()).toEqual({ type: "all", minPrice: 150 });
  });

  it("sets a maximum price without any upper cap", async () => {
    const { lastFilters } = setup();
    await userEvent.type(screen.getByRole("spinbutton", { name: "Maximum price" }), "250000");
    expect(lastFilters()).toEqual({ type: "all", maxPrice: 250000 });
  });

  it("accepts decimals", async () => {
    const { lastFilters } = setup();
    await userEvent.type(screen.getByRole("spinbutton", { name: "Maximum price" }), "19.9");
    expect(lastFilters().maxPrice).toBe(19.9);
  });

  it("removes a limit when its field is cleared", async () => {
    const { lastFilters } = setup({ type: "all", minPrice: 10, maxPrice: 500 });
    const min = screen.getByRole("spinbutton", { name: "Minimum price" });
    expect(min).toHaveValue(10);
    await userEvent.clear(min);
    expect(lastFilters()).toEqual({ type: "all", minPrice: undefined, maxPrice: 500 });
  });

  it("ignores a negative price", async () => {
    const { lastFilters } = setup();
    await userEvent.type(screen.getByRole("spinbutton", { name: "Minimum price" }), "-5");
    expect(lastFilters().minPrice).toBeUndefined();
  });

  it("keeps the other filters when the price changes", async () => {
    const { lastFilters } = setup({ type: "auction", categories: ["books"] });
    await userEvent.type(screen.getByRole("spinbutton", { name: "Maximum price" }), "30");
    expect(lastFilters()).toEqual({ type: "auction", categories: ["books"], maxPrice: 30 });
  });

  it("is translated in pt-BR", () => {
    setup(undefined, "pt-BR");
    expect(screen.getByRole("spinbutton", { name: "Preço mínimo" })).toHaveAttribute("placeholder", "Mín.");
    expect(screen.getByRole("spinbutton", { name: "Preço máximo" })).toHaveAttribute("placeholder", "Máx.");
    expect(screen.getAllByText("R$")).toHaveLength(2);
  });
});
