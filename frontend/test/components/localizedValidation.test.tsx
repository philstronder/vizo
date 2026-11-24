import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "@/components/ui/Field";
import { renderWithProviders } from "../render";

function Form() {
  return (
    <form>
      <Input aria-label="card" required />
      <Input aria-label="email" type="email" defaultValue="nope" />
      <Input aria-label="qty" type="number" min={2} defaultValue="1" />
    </form>
  );
}

describe("localized native validation", () => {
  it("shows required-field messages in Portuguese", () => {
    renderWithProviders(<Form />, { locale: "pt-BR" });
    const card = screen.getByLabelText("card") as HTMLInputElement;
    card.checkValidity();
    expect(card.validationMessage).toBe("Preencha este campo.");
  });

  it("shows other constraint messages in the active locale", () => {
    renderWithProviders(<Form />, { locale: "en-US" });
    const email = screen.getByLabelText("email") as HTMLInputElement;
    const qty = screen.getByLabelText("qty") as HTMLInputElement;
    email.checkValidity();
    qty.checkValidity();
    expect(email.validationMessage).toBe("Please enter a valid email address.");
    expect(qty.validationMessage).toBe("Value must be 2 or more.");
  });

  it("clears the message once the field is edited, so it can become valid", () => {
    renderWithProviders(<Form />, { locale: "pt-BR" });
    const card = screen.getByLabelText("card") as HTMLInputElement;
    card.checkValidity();
    fireEvent.input(card, { target: { value: "4242" } });
    expect(card.validity.valid).toBe(true);
  });

  it("clears messages before a new submit attempt when values were set from code", () => {
    renderWithProviders(<Form />, { locale: "pt-BR" });
    const card = screen.getByLabelText("card") as HTMLInputElement;
    card.checkValidity();
    card.value = "4242"; // no input event, like an autofilled field
    expect(card.validity.valid).toBe(false);
    fireEvent.click(document.body);
    expect(card.validity.valid).toBe(true);
  });
});
