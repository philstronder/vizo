import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "@/components/ui/Modal";
import { StarInput, StarRating } from "@/components/ui/StarRating";
import { renderWithProviders } from "../render";

describe("Modal", () => {
  it("renders nothing while closed", () => {
    renderWithProviders(
      <Modal open={false} onClose={() => {}} title="Withdraw">
        body
      </Modal>
    );
    expect(screen.queryByText("Withdraw")).not.toBeInTheDocument();
  });

  it("closes from the close button, the backdrop and Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <Modal open onClose={onClose} title="Withdraw">
        <p>body</p>
      </Modal>
    );
    expect(screen.getByRole("heading", { name: "Withdraw" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(container.querySelector(".fixed > .absolute")!);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("doesn't close when clicking inside", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <Modal open onClose={onClose} title="Withdraw">
        <p>body</p>
      </Modal>
    );
    await user.click(screen.getByText("body"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stops listening for Escape once closed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = renderWithProviders(
      <Modal open onClose={onClose} title="Withdraw">
        body
      </Modal>
    );
    rerender(
      <Modal open={false} onClose={onClose} title="Withdraw">
        body
      </Modal>
    );
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("StarRating", () => {
  it("announces the rating", () => {
    renderWithProviders(<StarRating value={4.25} />);
    expect(screen.getByLabelText("4.3 out of 5 stars")).toBeInTheDocument();
  });
});

describe("StarInput", () => {
  function Controlled() {
    const [value, setValue] = useState(0);
    return <StarInput value={value} onChange={setValue} />;
  }

  it("picks a rating", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Controlled />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(radios.every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);

    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(screen.getByRole("radio", { name: "4 stars" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "1 star" })).toHaveAttribute("aria-checked", "false");
  });
});
