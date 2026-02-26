import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Lobby from "./Lobby";
import type { Player } from "@/hooks/useGameRoom";

const PLAYERS_ONE: Player[] = [{ id: "p1", name: "Alice", submitted: false }];
const PLAYERS_TWO: Player[] = [
  { id: "p1", name: "Alice", submitted: false },
  { id: "p2", name: "Bob", submitted: false },
];

describe("Lobby", () => {
  it("displays the room code", () => {
    render(<Lobby roomCode="WOLF" players={PLAYERS_TWO} onStart={vi.fn()} />);
    expect(screen.getByText("WOLF")).toBeInTheDocument();
  });

  it("lists all player names", () => {
    render(<Lobby roomCode="WOLF" players={PLAYERS_TWO} onStart={vi.fn()} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows the player count", () => {
    render(<Lobby roomCode="WOLF" players={PLAYERS_TWO} onStart={vi.fn()} />);
    expect(screen.getByText(/Players \(2\)/i)).toBeInTheDocument();
  });

  it("shows a waiting message when fewer than 2 players are present", () => {
    render(<Lobby roomCode="WOLF" players={PLAYERS_ONE} onStart={vi.fn()} />);
    expect(
      screen.getByText(/waiting for at least one more player/i)
    ).toBeInTheDocument();
  });

  it("hides the waiting message when 2 or more players are present", () => {
    render(<Lobby roomCode="WOLF" players={PLAYERS_TWO} onStart={vi.fn()} />);
    expect(
      screen.queryByText(/waiting for at least one more player/i)
    ).not.toBeInTheDocument();
  });

  it("disables the Start button with fewer than 2 players", () => {
    render(<Lobby roomCode="WOLF" players={PLAYERS_ONE} onStart={vi.fn()} />);
    expect(screen.getByRole("button", { name: /start game/i })).toBeDisabled();
  });

  it("enables the Start button with 2 or more players", () => {
    render(<Lobby roomCode="WOLF" players={PLAYERS_TWO} onStart={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /start game/i })
    ).not.toBeDisabled();
  });

  it("calls onStart when the Start button is clicked", () => {
    const onStart = vi.fn();
    render(<Lobby roomCode="WOLF" players={PLAYERS_TWO} onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("copies the full room URL to the clipboard when the code is clicked", async () => {
    render(<Lobby roomCode="WOLF" players={PLAYERS_TWO} onStart={vi.fn()} />);
    fireEvent.click(screen.getByTitle(/click to share/i));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/room/WOLF")
    );
  });
});
