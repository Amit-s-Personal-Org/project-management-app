import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AISidebar } from "@/components/AISidebar";
import { initialData } from "@/lib/kanban";
import * as api from "@/lib/api";

vi.mock("@/lib/api");

const noop = () => {};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.sendChat).mockResolvedValue({
    message: "I can help with that!",
    board_update: null,
  });
});

describe("AISidebar", () => {
  it("shows placeholder text when open with no messages", () => {
    render(<AISidebar isOpen={true} onClose={noop} onBoardUpdate={noop} />);
    expect(screen.getByText(/ask me to help/i)).toBeInTheDocument();
  });

  it("sends a message and shows user bubble then assistant reply", async () => {
    render(<AISidebar isOpen={true} onClose={noop} onBoardUpdate={noop} />);

    await userEvent.type(screen.getByLabelText("Chat input"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(screen.getByText("Hello")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("I can help with that!")).toBeInTheDocument()
    );
  });

  it("clears the input after sending", async () => {
    render(<AISidebar isOpen={true} onClose={noop} onBoardUpdate={noop} />);
    const input = screen.getByLabelText("Chat input");
    await userEvent.type(input, "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(input).toHaveValue("");
  });

  it("calls onBoardUpdate when AI returns board_update", async () => {
    const onBoardUpdate = vi.fn();
    vi.mocked(api.sendChat).mockResolvedValue({
      message: "Done! I moved the card.",
      board_update: initialData,
    });

    render(
      <AISidebar isOpen={true} onClose={noop} onBoardUpdate={onBoardUpdate} />
    );

    await userEvent.type(screen.getByLabelText("Chat input"), "Move a card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(onBoardUpdate).toHaveBeenCalledWith(initialData)
    );
  });

  it("does not call onBoardUpdate when board_update is null", async () => {
    const onBoardUpdate = vi.fn();
    render(
      <AISidebar isOpen={true} onClose={noop} onBoardUpdate={onBoardUpdate} />
    );

    await userEvent.type(screen.getByLabelText("Chat input"), "Just chat");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText("I can help with that!")).toBeInTheDocument()
    );
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("shows an error message when the request fails", async () => {
    vi.mocked(api.sendChat).mockRejectedValue(new Error("Network error"));

    render(<AISidebar isOpen={true} onClose={noop} onBoardUpdate={noop} />);
    await userEvent.type(screen.getByLabelText("Chat input"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/failed to get a response/i)
      ).toBeInTheDocument()
    );
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(<AISidebar isOpen={true} onClose={onClose} onBoardUpdate={noop} />);
    await userEvent.click(screen.getByRole("button", { name: /close ai sidebar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("passes prior conversation as history when sending a follow-up", async () => {
    render(<AISidebar isOpen={true} onClose={noop} onBoardUpdate={noop} />);

    // First message
    await userEvent.type(screen.getByLabelText("Chat input"), "First");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => screen.getByText("I can help with that!"));

    // Second message — history should include the first exchange
    await userEvent.type(screen.getByLabelText("Chat input"), "Second");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(api.sendChat).toHaveBeenCalledTimes(2));
    const [, historyArg] = vi.mocked(api.sendChat).mock.calls[1];
    expect(historyArg).toHaveLength(2); // user + assistant from first turn
    expect(historyArg[0]).toEqual({ role: "user", content: "First" });
  });
});
