import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeliveryAddressFields,
  EMPTY_ADDRESS,
  formatAddress,
  isAddressComplete,
  trimAddress,
} from "@/components/account/DeliveryAddressFields";
import { ApiError, lookupCep, type CepAddress } from "@/lib/api";
import type { DeliveryAddress } from "@/types";
import { renderWithProviders } from "../render";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  lookupCep: vi.fn(),
}));

const PAULISTA: CepAddress = {
  postalCode: "01310-100",
  street: "Avenida Paulista",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
};

function Form({ withComplement }: { withComplement?: boolean }) {
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  return <DeliveryAddressFields value={address} onChange={setAddress} withComplement={withComplement} />;
}

// The inputs follow their label, which isn't linked to them.
const input = (label: string) => screen.getByText(label).nextElementSibling as HTMLInputElement;

beforeEach(() => {
  vi.mocked(lookupCep).mockResolvedValue(PAULISTA);
});

describe("DeliveryAddressFields", () => {
  it("fills in the address from the ZIP code once it has 8 digits", async () => {
    renderWithProviders(<Form />);
    await userEvent.type(input("ZIP code"), "01310-10");
    expect(lookupCep).not.toHaveBeenCalled();
    await userEvent.type(input("ZIP code"), "0");
    expect(lookupCep).toHaveBeenCalledWith("01310100");
    await waitFor(() => expect(input("Street")).toHaveValue("Avenida Paulista"));
    expect(input("City")).toHaveValue("São Paulo");
    expect(input("State")).toHaveValue("SP");
    expect(input("ZIP code")).toHaveValue("01310-100");
  });

  it("keeps a street typed by hand when the ZIP code covers a whole town", async () => {
    vi.mocked(lookupCep).mockResolvedValue({ ...PAULISTA, street: "", district: "" });
    renderWithProviders(<Form />);
    await userEvent.type(input("Street"), "Rua das Flores");
    await userEvent.type(input("ZIP code"), "13165000");
    await waitFor(() => expect(input("City")).toHaveValue("São Paulo"));
    expect(input("Street")).toHaveValue("Rua das Flores");
  });

  it("keeps what was typed while the lookup was in flight", async () => {
    let resolve!: (a: CepAddress) => void;
    vi.mocked(lookupCep).mockReturnValue(new Promise((r) => (resolve = r)));
    renderWithProviders(<Form />);
    await userEvent.type(input("ZIP code"), "01310100");
    expect(screen.getByText("Looking up ZIP code...")).toBeInTheDocument();
    await userEvent.type(input("Number"), "1500");
    resolve(PAULISTA);
    await waitFor(() => expect(input("Street")).toHaveValue("Avenida Paulista"));
    expect(input("Number")).toHaveValue("1500");
    expect(screen.queryByText("Looking up ZIP code...")).not.toBeInTheDocument();
  });

  it("ignores an answer for a ZIP code that was changed since", async () => {
    let resolveFirst!: (a: CepAddress) => void;
    vi.mocked(lookupCep).mockReturnValueOnce(new Promise((r) => (resolveFirst = r)));
    renderWithProviders(<Form />);
    await userEvent.type(input("ZIP code"), "01310100");
    await userEvent.type(input("ZIP code"), "{Backspace}");
    resolveFirst(PAULISTA);
    await new Promise((r) => setTimeout(r, 0));
    expect(input("Street")).toHaveValue("");
  });

  it("says when the ZIP code doesn't exist, or the lookup failed", async () => {
    vi.mocked(lookupCep).mockRejectedValueOnce(new ApiError("CEP not found", 404));
    renderWithProviders(<Form />);
    await userEvent.type(input("ZIP code"), "99999999");
    expect(await screen.findByText("ZIP code not found")).toBeInTheDocument();

    vi.mocked(lookupCep).mockRejectedValueOnce(new ApiError("Bad gateway", 502));
    await userEvent.clear(input("ZIP code"));
    await userEvent.type(input("ZIP code"), "88888888");
    expect(await screen.findByText("Could not look up the ZIP code; fill in the address manually")).toBeInTheDocument();
  });

  it("has no complement for a condominium address", () => {
    renderWithProviders(<Form withComplement={false} />);
    expect(screen.queryByText("Complement")).not.toBeInTheDocument();
  });

  it("tracks the complement in the address", async () => {
    renderWithProviders(<Form />);
    await userEvent.type(input("Complement"), "Apt 4");
    expect(input("Complement")).toHaveValue("Apt 4");
  });
});

describe("address helpers", () => {
  const full: DeliveryAddress = { ...PAULISTA, number: "1500", complement: "" };

  it("needs every field but the complement", () => {
    expect(isAddressComplete(full)).toBe(true);
    expect(isAddressComplete({ ...full, number: "  " })).toBe(false);
  });

  it("trims fields and drops a blank complement", () => {
    expect(trimAddress({ ...full, street: "  Avenida Paulista ", complement: "  " })).toEqual({
      ...PAULISTA,
      number: "1500",
      complement: undefined,
    });
  });

  it("formats an address on one line", () => {
    expect(formatAddress({ ...full, complement: "Apt 4" })).toBe(
      "Avenida Paulista, 1500 - Apt 4, Bela Vista, São Paulo - SP, 01310-100"
    );
    expect(formatAddress(full)).toBe("Avenida Paulista, 1500, Bela Vista, São Paulo - SP, 01310-100");
  });
});
