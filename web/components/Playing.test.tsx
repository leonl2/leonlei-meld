import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Playing from "./Playing";
import type { Player, RoundEntry } from "@/hooks/useGameRoom";

const PLAYERS: Player[] = [
  { id: "p1", name: "Alice", submitted: false },
  { id: "p2", name: "Bob", submitted: false },
];

const PLAYERS_ALICE_SUBMITTED: Player[] = [
  { id: "p1", name: "Alice", submitted: true },
  { id: "p2", name: "Bob", submitted: false },
];

const ROUND_HISTORY: RoundEntry[] = [
  {
    submissions: [
      { id: "p1", name: "Alice", word: "apple" },
      { id: "p2", name: "Bob", word: "banana" },
    ],
    won: false,
  },
];

/** Default no-op restart props so individual tests only set what they care about */
const NO_VOTE = {
  restartVotes: [] as string[],
  onRequestRestart: vi.fn(),
  onCancelRestart: vi.fn(),
  mySubmittedWord: null as string | null,
  onRetract: vi.fn(),
};

describe("Playing", () => {
  describe("player status indicators", () => {
    it("shows all player names", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
        />
      );
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("shows the submission count ratio when there are 2+ players", () => {
      render(
        <Playing
          players={PLAYERS_ALICE_SUBMITTED}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p2"
          {...NO_VOTE}
        />
      );
      expect(screen.getByText("1/2")).toBeInTheDocument();
    });
  });

  describe("word input — not yet submitted", () => {
    it("shows the word input when the local player has not submitted", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
        />
      );
      expect(screen.getByPlaceholderText(/type a word/i)).toBeInTheDocument();
    });

    it("submit button is disabled when the input is empty", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
        />
      );
      expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
    });

    it("submit button is enabled once the user types a word", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
        />
      );
      fireEvent.change(screen.getByPlaceholderText(/type a word/i), {
        target: { value: "apple" },
      });
      expect(
        screen.getByRole("button", { name: /submit/i })
      ).not.toBeDisabled();
    });

    it("calls onSubmit with the trimmed word when Submit is clicked", () => {
      const onSubmit = vi.fn();
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={onSubmit}
          myId="p1"
          {...NO_VOTE}
        />
      );
      fireEvent.change(screen.getByPlaceholderText(/type a word/i), {
        target: { value: "  apple  " },
      });
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));
      expect(onSubmit).toHaveBeenCalledWith("apple");
    });

    it("calls onSubmit when Enter is pressed in the input", () => {
      const onSubmit = vi.fn();
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={onSubmit}
          myId="p1"
          {...NO_VOTE}
        />
      );
      const input = screen.getByPlaceholderText(/type a word/i);
      fireEvent.change(input, { target: { value: "apple" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onSubmit).toHaveBeenCalledWith("apple");
    });

    it("does not call onSubmit for an empty string", () => {
      const onSubmit = vi.fn();
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={onSubmit}
          myId="p1"
          {...NO_VOTE}
        />
      );
      fireEvent.keyDown(screen.getByPlaceholderText(/type a word/i), {
        key: "Enter",
      });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("word input — already submitted", () => {
    it("hides the input and shows the submitted word after submission", () => {
      render(
        <Playing
          players={PLAYERS_ALICE_SUBMITTED}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
          mySubmittedWord="apple"
          onRetract={vi.fn()}
        />
      );
      expect(
        screen.queryByPlaceholderText(/type a word/i)
      ).not.toBeInTheDocument();
      expect(screen.getByText("apple")).toBeInTheDocument();
    });

    it("shows a Change button when submitted", () => {
      render(
        <Playing
          players={PLAYERS_ALICE_SUBMITTED}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
          mySubmittedWord="apple"
          onRetract={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /change/i })).toBeInTheDocument();
    });

    it("clicking Change calls onRetract", () => {
      const onRetract = vi.fn();
      render(
        <Playing
          players={PLAYERS_ALICE_SUBMITTED}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
          mySubmittedWord="apple"
          onRetract={onRetract}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /change/i }));
      expect(onRetract).toHaveBeenCalledOnce();
    });
  });

  describe("error display", () => {
    it("shows the error message when the error prop is set", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error='"apple" was used in a previous round.'
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
        />
      );
      expect(
        screen.getByText(/"apple" was used in a previous round\./i)
      ).toBeInTheDocument();
    });

    it("hides the error message when error is null", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
        />
      );
      expect(
        screen.queryByText(/was used in a previous round/i)
      ).not.toBeInTheDocument();
    });
  });

  describe("round history", () => {
    it("renders the most recent round's words", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={ROUND_HISTORY}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
        />
      );
      expect(screen.getByText("apple")).toBeInTheDocument();
      expect(screen.getByText("banana")).toBeInTheDocument();
    });

    it("shows player names as column headers in the history table", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={ROUND_HISTORY}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
        />
      );
      // Names appear both as history labels (below the word) AND in the player
      // status row, so each name should appear at least twice.
      expect(screen.getAllByText("Alice").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("Bob").length).toBeGreaterThanOrEqual(2);
    });

    it("changes the input placeholder after the first round", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={ROUND_HISTORY}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
        />
      );
      expect(
        screen.getByPlaceholderText(/think of a common thread/i)
      ).toBeInTheDocument();
    });
  });

  describe("restart vote", () => {
    it("shows a subtle restart button when no vote is active", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          {...NO_VOTE}
        />
      );
      expect(screen.getByRole("button", { name: /restart/i })).toBeInTheDocument();
    });

    it("calls onRequestRestart when the restart button is clicked", () => {
      const onRequestRestart = vi.fn();
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          restartVotes={[]}
          onRequestRestart={onRequestRestart}
          onCancelRestart={vi.fn()}
          mySubmittedWord={null}
          onRetract={vi.fn()}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /restart/i }));
      expect(onRequestRestart).toHaveBeenCalledOnce();
    });

    it("shows the vote card with Agree and Nope when a vote is active and I haven't voted", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p2"
          restartVotes={["p1"]}
          onRequestRestart={vi.fn()}
          onCancelRestart={vi.fn()}
          mySubmittedWord={null}
          onRetract={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /agree/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /nope/i })).toBeInTheDocument();
    });

    it("shows waiting state with Cancel when I have already voted", () => {
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          restartVotes={["p1"]}
          onRequestRestart={vi.fn()}
          onCancelRestart={vi.fn()}
          mySubmittedWord={null}
          onRetract={vi.fn()}
        />
      );
      expect(screen.getByText(/waiting for/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("calls onCancelRestart when Nope is clicked", () => {
      const onCancelRestart = vi.fn();
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p2"
          restartVotes={["p1"]}
          onRequestRestart={vi.fn()}
          onCancelRestart={onCancelRestart}
          mySubmittedWord={null}
          onRetract={vi.fn()}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /nope/i }));
      expect(onCancelRestart).toHaveBeenCalledOnce();
    });

    it("calls onCancelRestart when Cancel is clicked by the initiator", () => {
      const onCancelRestart = vi.fn();
      render(
        <Playing
          players={PLAYERS}
          roundHistory={[]}
          error={null}
          onSubmit={vi.fn()}
          myId="p1"
          restartVotes={["p1"]}
          onRequestRestart={vi.fn()}
          onCancelRestart={onCancelRestart}
          mySubmittedWord={null}
          onRetract={vi.fn()}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onCancelRestart).toHaveBeenCalledOnce();
    });
  });
});
