import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import Won from "./Won";
import type { RoundEntry } from "@/hooks/useGameRoom";

const ROUND_HISTORY_LOSS_THEN_WIN: RoundEntry[] = [
  {
    submissions: [
      { name: "Alice", word: "apple" },
      { name: "Bob", word: "banana" },
    ],
    won: false,
  },
  {
    submissions: [
      { name: "Alice", word: "meld" },
      { name: "Bob", word: "meld" },
    ],
    won: true,
  },
];

const SINGLE_WIN: RoundEntry[] = [
  {
    submissions: [
      { name: "Alice", word: "meld" },
      { name: "Bob", word: "meld" },
    ],
    won: true,
  },
];

describe("Won", () => {
  it("shows the Meld! heading", () => {
    render(<Won roundHistory={SINGLE_WIN} onReset={vi.fn()} />);
    expect(screen.getByText("Meld!")).toBeInTheDocument();
  });

  it("shows the correct round count (singular)", () => {
    render(<Won roundHistory={SINGLE_WIN} onReset={vi.fn()} />);
    expect(screen.getByText(/1 round$/i)).toBeInTheDocument();
  });

  it("shows the correct round count (plural)", () => {
    render(
      <Won roundHistory={ROUND_HISTORY_LOSS_THEN_WIN} onReset={vi.fn()} />
    );
    expect(screen.getByText(/2 rounds$/i)).toBeInTheDocument();
  });

  it("shows player names as table column headers", () => {
    render(
      <Won roundHistory={ROUND_HISTORY_LOSS_THEN_WIN} onReset={vi.fn()} />
    );
    expect(
      screen.getByRole("columnheader", { name: /alice/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /bob/i })
    ).toBeInTheDocument();
  });

  it("shows each player's submitted word per round", () => {
    render(
      <Won roundHistory={ROUND_HISTORY_LOSS_THEN_WIN} onReset={vi.fn()} />
    );
    expect(screen.getByText("apple")).toBeInTheDocument();
    expect(screen.getByText("banana")).toBeInTheDocument();
  });

  it("shows the winning word with a checkmark", () => {
    render(
      <Won roundHistory={ROUND_HISTORY_LOSS_THEN_WIN} onReset={vi.fn()} />
    );
    // The winning round has "meld ✓" cells
    const cells = screen.getAllByText(/meld/);
    expect(cells.some((c) => c.textContent?.includes("✓"))).toBe(true);
  });

  it("calls onReset when Play again is clicked", () => {
    const onReset = vi.fn();
    render(<Won roundHistory={SINGLE_WIN} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: /play again/i }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("renders gracefully with an empty round history", () => {
    render(<Won roundHistory={[]} onReset={vi.fn()} />);
    expect(screen.getByText("Meld!")).toBeInTheDocument();
    expect(screen.getByText(/0 rounds/i)).toBeInTheDocument();
  });
});
