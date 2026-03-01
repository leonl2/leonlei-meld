import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import Won from "./Won";
import type { Player, RoundEntry } from "@/hooks/useGameRoom";

const PLAYERS: Player[] = [
  { id: "p1", name: "Alice", submitted: false },
  { id: "p2", name: "Bob", submitted: false },
];

const ROUND_HISTORY_LOSS_THEN_WIN: RoundEntry[] = [
  {
    submissions: [
      { id: "p1", name: "Alice", word: "apple" },
      { id: "p2", name: "Bob", word: "banana" },
    ],
    won: false,
  },
  {
    submissions: [
      { id: "p1", name: "Alice", word: "meld" },
      { id: "p2", name: "Bob", word: "meld" },
    ],
    won: true,
  },
];

const SINGLE_WIN: RoundEntry[] = [
  {
    submissions: [
      { id: "p1", name: "Alice", word: "meld" },
      { id: "p2", name: "Bob", word: "meld" },
    ],
    won: true,
  },
];

/** Default no-vote props so individual tests only set what they care about. */
const NO_RESET = {
  players: PLAYERS,
  resetVotes: [] as string[],
  onRequestReset: vi.fn(),
  onCancelReset: vi.fn(),
};

describe("Won", () => {
  it("shows the Meld! heading", () => {
    render(<Won roundHistory={SINGLE_WIN} {...NO_RESET} />);
    expect(screen.getByText("Meld!")).toBeInTheDocument();
  });

  it("shows the correct round count (singular)", () => {
    render(<Won roundHistory={SINGLE_WIN} {...NO_RESET} />);
    expect(screen.getByText(/1 round$/i)).toBeInTheDocument();
  });

  it("shows the correct round count (plural)", () => {
    render(<Won roundHistory={ROUND_HISTORY_LOSS_THEN_WIN} {...NO_RESET} />);
    expect(screen.getByText(/2 rounds$/i)).toBeInTheDocument();
  });

  it("shows player names as table column headers", () => {
    render(<Won roundHistory={ROUND_HISTORY_LOSS_THEN_WIN} {...NO_RESET} />);
    expect(screen.getByRole("columnheader", { name: /alice/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /bob/i })).toBeInTheDocument();
  });

  it("shows each player's submitted word per round", () => {
    render(<Won roundHistory={ROUND_HISTORY_LOSS_THEN_WIN} {...NO_RESET} />);
    expect(screen.getByText("apple")).toBeInTheDocument();
    expect(screen.getByText("banana")).toBeInTheDocument();
  });

  it("shows the winning word with a checkmark", () => {
    render(<Won roundHistory={ROUND_HISTORY_LOSS_THEN_WIN} {...NO_RESET} />);
    const cells = screen.getAllByText(/meld/);
    expect(cells.some((c) => c.textContent?.includes("✓"))).toBe(true);
  });

  it("renders gracefully with an empty round history", () => {
    render(<Won roundHistory={[]} {...NO_RESET} />);
    expect(screen.getByText("Meld!")).toBeInTheDocument();
    expect(screen.getByText(/0 rounds/i)).toBeInTheDocument();
  });

  it("shows each player's correct word when submission ids are missing (old persisted state)", () => {
    const noIdHistory = [
      {
        submissions: [
          { id: undefined as unknown as string, name: "Alice", word: "apple" },
          { id: undefined as unknown as string, name: "Bob", word: "banana" },
        ],
        won: false,
      },
    ] satisfies RoundEntry[];
    render(<Won roundHistory={noIdHistory} {...NO_RESET} />);
    expect(screen.getByText("apple")).toBeInTheDocument();
    expect(screen.getByText("banana")).toBeInTheDocument();
  });

  it("shows a column for a replacement player who joined mid-game", () => {
    const replacementHistory: RoundEntry[] = [
      {
        submissions: [
          { id: "p1", name: "Alice", word: "apple" },
          { id: "p2", name: "Bob", word: "banana" },
        ],
        won: false,
      },
      {
        submissions: [
          { id: "p1", name: "Alice", word: "meld" },
          { id: "p3", name: "Carol", word: "meld" },
        ],
        won: true,
      },
    ];
    render(<Won roundHistory={replacementHistory} {...NO_RESET} />);
    expect(screen.getByRole("columnheader", { name: /alice/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /bob/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /carol/i })).toBeInTheDocument();
    const meldCells = screen.getAllByText(/meld/);
    expect(meldCells.some((c) => c.textContent?.includes("✓"))).toBe(true);
    expect(screen.getByText("banana")).toBeInTheDocument();
  });

  it("correctly assigns words to the right player when names are identical", () => {
    const duplicateNames: RoundEntry[] = [
      {
        submissions: [
          { id: "p1", name: "Alice", word: "apple" },
          { id: "p2", name: "Alice", word: "banana" },
        ],
        won: false,
      },
    ];
    render(<Won roundHistory={duplicateNames} {...NO_RESET} />);
    expect(screen.getByText("apple")).toBeInTheDocument();
    expect(screen.getByText("banana")).toBeInTheDocument();
  });

  describe("play again vote", () => {
    it("shows Play again button when no vote is active", () => {
      render(<Won roundHistory={SINGLE_WIN} {...NO_RESET} />);
      expect(screen.getByRole("button", { name: /play again/i })).toBeInTheDocument();
    });

    it("calls onRequestReset when Play again is clicked", () => {
      const onRequestReset = vi.fn();
      render(
        <Won
          roundHistory={SINGLE_WIN}
          players={PLAYERS}
          resetVotes={[]}
          onRequestReset={onRequestReset}
          onCancelReset={vi.fn()}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /play again/i }));
      expect(onRequestReset).toHaveBeenCalledOnce();
    });

    it("shows Agree and Nope when a vote is active and I haven't voted", () => {
      render(
        <Won
          roundHistory={SINGLE_WIN}
          myId="p2"
          players={PLAYERS}
          resetVotes={["p1"]}
          onRequestReset={vi.fn()}
          onCancelReset={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /agree/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /nope/i })).toBeInTheDocument();
    });

    it("shows waiting state with Cancel when I have already voted", () => {
      render(
        <Won
          roundHistory={SINGLE_WIN}
          myId="p1"
          players={PLAYERS}
          resetVotes={["p1"]}
          onRequestReset={vi.fn()}
          onCancelReset={vi.fn()}
        />
      );
      expect(screen.getByText(/waiting for/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("calls onCancelReset when Nope is clicked", () => {
      const onCancelReset = vi.fn();
      render(
        <Won
          roundHistory={SINGLE_WIN}
          myId="p2"
          players={PLAYERS}
          resetVotes={["p1"]}
          onRequestReset={vi.fn()}
          onCancelReset={onCancelReset}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /nope/i }));
      expect(onCancelReset).toHaveBeenCalledOnce();
    });

    it("calls onCancelReset when Cancel is clicked by the initiator", () => {
      const onCancelReset = vi.fn();
      render(
        <Won
          roundHistory={SINGLE_WIN}
          myId="p1"
          players={PLAYERS}
          resetVotes={["p1"]}
          onRequestReset={vi.fn()}
          onCancelReset={onCancelReset}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onCancelReset).toHaveBeenCalledOnce();
    });
  });
});
