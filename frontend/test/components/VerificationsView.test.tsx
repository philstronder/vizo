import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerificationsView } from "@/components/verifications/VerificationsView";
import { approveResidency, fetchResidencyRequests, rejectResidency, type ResidencyRequest } from "@/lib/api";
import { renderWithProviders } from "../render";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchResidencyRequests: vi.fn(),
  approveResidency: vi.fn(),
  rejectResidency: vi.fn(),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "m1", isAdmin: false, buildingAdminOf: [{ id: "c1", name: "Aurora" }] } }),
}));

const request = (overrides: Partial<ResidencyRequest> = {}): ResidencyRequest => ({
  userId: "u1",
  name: "Ana Souza",
  email: "ana@example.com",
  buildingName: "Aurora",
  buildingBlock: "B",
  unitNumber: "42",
  proofPhoto: "data:image/jpeg;base64,AAAA",
  submittedAt: "2026-11-23T10:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  vi.mocked(approveResidency).mockResolvedValue();
  vi.mocked(rejectResidency).mockResolvedValue();
});

describe("VerificationsView", () => {
  it("shows the building admin's queue with the proof photo, and approves a request", async () => {
    vi.mocked(fetchResidencyRequests).mockResolvedValue([request(), request({ userId: "u2", name: "Bruno", buildingBlock: undefined, unitNumber: "7" })]);
    renderWithProviders(<VerificationsView />);

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText(/People who want to join Aurora/)).toBeInTheDocument();
    expect(screen.getByText("Block B · Unit 42")).toBeInTheDocument();
    expect(screen.getAllByAltText("Proof of residency of Ana Souza")[0]).toHaveAttribute("src", "data:image/jpeg;base64,AAAA");

    await userEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);
    expect(approveResidency).toHaveBeenCalledWith("u1");
    await waitFor(() => expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument());
    expect(screen.getByText("Bruno")).toBeInTheDocument();
  });

  it("rejects with a reason", async () => {
    vi.mocked(fetchResidencyRequests).mockResolvedValue([request()]);
    renderWithProviders(<VerificationsView />);

    await userEvent.click(await screen.findByRole("button", { name: "Reject" }));
    await userEvent.type(screen.getByPlaceholderText(/address on the bill/), "  Blurry photo ");
    await userEvent.click(screen.getByRole("button", { name: "Reject request" }));
    expect(rejectResidency).toHaveBeenCalledWith("u1", "Blurry photo");
    expect(await screen.findByText("All caught up")).toBeInTheDocument();
  });

  it("keeps the request and explains when the decision fails", async () => {
    vi.mocked(fetchResidencyRequests).mockResolvedValue([request()]);
    vi.mocked(approveResidency).mockRejectedValue(new Error("offline"));
    renderWithProviders(<VerificationsView />);

    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Could not save your decision")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
  });

  it("says when there's nothing to review", async () => {
    vi.mocked(fetchResidencyRequests).mockResolvedValue([]);
    renderWithProviders(<VerificationsView />);
    expect(await screen.findByText("No proofs of residency are waiting for review.")).toBeInTheDocument();
  });
});
