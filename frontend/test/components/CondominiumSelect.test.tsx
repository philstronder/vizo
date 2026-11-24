import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CondominiumSelect } from "@/components/account/CondominiumSelect";
import { fetchCondominiums } from "@/lib/api";
import { renderWithProviders } from "../render";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchCondominiums: vi.fn(),
}));

const rows = ["Edifício Aurora", "Residencial São Paulo", "Torre Boreal"].map((name, i) => ({ id: String(i), name }));

function Picker({ initial = "", onChange = () => {} }: { initial?: string; onChange?: (name: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <CondominiumSelect
      required
      value={value}
      onChange={(name) => {
        setValue(name);
        onChange(name);
      }}
    />
  );
}

const options = () => screen.queryAllByRole("option").map((o) => o.textContent);

beforeEach(() => {
  vi.mocked(fetchCondominiums).mockResolvedValue(rows);
});

describe("CondominiumSelect", () => {
  it("lists every condominium when focused", async () => {
    renderWithProviders(<Picker />);
    await userEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(options()).toEqual(["Edifício Aurora", "Residencial São Paulo", "Torre Boreal"]));
  });

  it("searches ignoring case and accents", async () => {
    renderWithProviders(<Picker />);
    await waitFor(() => expect(fetchCondominiums).toHaveBeenCalled());
    await userEvent.type(screen.getByRole("combobox"), "SAO");
    expect(options()).toEqual(["Residencial São Paulo"]);
    await userEvent.clear(screen.getByRole("combobox"));
    await userEvent.type(screen.getByRole("combobox"), "edificio");
    expect(options()).toEqual(["Edifício Aurora"]);
  });

  it("says when nothing matches", async () => {
    renderWithProviders(<Picker />);
    await waitFor(() => expect(fetchCondominiums).toHaveBeenCalled());
    await userEvent.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText("No condominium found")).toBeInTheDocument();
  });

  it("picks with the mouse and shows the choice once closed", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Picker onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Torre Boreal" }));
    expect(onChange).toHaveBeenCalledWith("Torre Boreal");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("Torre Boreal");
  });

  it("picks with the keyboard, without submitting the form", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    renderWithProviders(
      <form onSubmit={onSubmit}>
        <Picker />
      </form>
    );
    await waitFor(() => expect(fetchCondominiums).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}{Enter}");
    expect(screen.getByRole("combobox")).toHaveValue("Residencial São Paulo");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the previous choice when closed with Escape or by leaving the field", async () => {
    renderWithProviders(<Picker initial="Torre Boreal" />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByRole("combobox"), "aur");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("combobox")).toHaveValue("Torre Boreal");
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.tab();
    expect(screen.getByRole("combobox")).toHaveValue("Torre Boreal");
  });

  it("still offers a resident's condominium after it was removed from the list", async () => {
    renderWithProviders(<Picker initial="Old Tower" />);
    await userEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(options()).toEqual(["Old Tower", ...rows.map((r) => r.name)]));
  });

  it("only requires a value until one is picked", async () => {
    renderWithProviders(<Picker />);
    expect(screen.getByRole("combobox")).toBeRequired();
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Torre Boreal" }));
    expect(screen.getByRole("combobox")).not.toBeRequired();
  });
});
