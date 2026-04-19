import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData, type BoardData } from "@/lib/kanban";
import type { BoardInfo } from "@/lib/api";
import * as api from "@/lib/api";

vi.mock("@/lib/api");

const TEST_BOARD_ID = 1;
const TEST_BOARDS: BoardInfo[] = [{ id: 1, name: "My Board", created_at: "" }];

beforeEach(() => {
  vi.mocked(api.getBoard).mockResolvedValue(initialData);
  vi.mocked(api.saveBoard).mockImplementation(async (_id: number, board: BoardData) => board);
  vi.mocked(api.getBoards).mockResolvedValue(TEST_BOARDS);
  vi.mocked(api.createBoard).mockResolvedValue(TEST_BOARDS[0]);
  vi.mocked(api.deleteBoard).mockResolvedValue(undefined);
});

const defaultProps = {
  boardId: TEST_BOARD_ID,
  boards: TEST_BOARDS,
  onBoardsChange: vi.fn(),
  onSwitchBoard: vi.fn(),
};

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard username display", () => {
  it("shows the username when provided", async () => {
    render(<KanbanBoard {...defaultProps} username="alice" onLogout={vi.fn()} />);
    await waitFor(() => screen.getAllByTestId(/column-/i));
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("does not show a username element when omitted", async () => {
    render(<KanbanBoard {...defaultProps} onLogout={vi.fn()} />);
    await waitFor(() => screen.getAllByTestId(/column-/i));
    expect(screen.queryByText("alice")).not.toBeInTheDocument();
  });

  it("shows Log out button alongside username", async () => {
    render(<KanbanBoard {...defaultProps} username="bob" onLogout={vi.fn()} />);
    await waitFor(() => screen.getAllByTestId(/column-/i));
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });
});

describe("KanbanBoard", () => {
  it("renders five columns after loading", async () => {
    render(<KanbanBoard {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getAllByTestId(/column-/i)).toHaveLength(5)
    );
  });

  it("renames a column", async () => {
    render(<KanbanBoard {...defaultProps} />);
    await waitFor(() => screen.getAllByTestId(/column-/i));

    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard {...defaultProps} />);
    await waitFor(() => screen.getAllByTestId(/column-/i));

    const column = getFirstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /add a card/i })
    );

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(
      within(column).getByRole("button", { name: /add card/i })
    );
    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);
    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });
});
