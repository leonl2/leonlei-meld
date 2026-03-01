import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Home from "./page";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("Home", () => {
  beforeEach(() => {
    mockPush.mockClear();
    sessionStorage.clear();
  });

  describe("Create room", () => {
    it("shows an error when creating without a name", () => {
      render(<Home />);
      fireEvent.click(screen.getByRole("button", { name: /create room/i }));
      expect(screen.getByText(/enter your name first/i)).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("navigates to a room when creating with a name", () => {
      render(<Home />);
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Leon/i), {
        target: { value: "Leon" },
      });
      fireEvent.click(screen.getByRole("button", { name: /create room/i }));
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringMatching(/^\/room\/[A-Z2-9]{4}$/)
      );
    });

    it("pressing Enter on the name input creates a room", () => {
      render(<Home />);
      const nameInput = screen.getByPlaceholderText(/e\.g\. Leon/i);
      fireEvent.change(nameInput, { target: { value: "Leon" } });
      fireEvent.keyDown(nameInput, { key: "Enter" });
      expect(mockPush).toHaveBeenCalled();
    });
  });

  describe("Join room", () => {
    it("navigates to the room without requiring a name", () => {
      render(<Home />);
      fireEvent.change(screen.getByPlaceholderText("WOLF"), {
        target: { value: "ABCD" },
      });
      fireEvent.click(screen.getByRole("button", { name: /join room/i }));
      expect(screen.queryByText(/enter your name first/i)).not.toBeInTheDocument();
      expect(mockPush).toHaveBeenCalledWith("/room/ABCD");
    });

    it("shows an error when the room code is not 4 characters", () => {
      render(<Home />);
      fireEvent.change(screen.getByPlaceholderText("WOLF"), {
        target: { value: "AB" },
      });
      fireEvent.click(screen.getByRole("button", { name: /join room/i }));
      expect(
        screen.getByText(/room code must be 4 characters/i)
      ).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("navigates to the correct room with a valid code", () => {
      render(<Home />);
      fireEvent.change(screen.getByPlaceholderText("WOLF"), {
        target: { value: "WOLF" },
      });
      fireEvent.click(screen.getByRole("button", { name: /join room/i }));
      expect(mockPush).toHaveBeenCalledWith("/room/WOLF");
    });

    it("pressing Enter on the code input joins the room", () => {
      render(<Home />);
      const codeInput = screen.getByPlaceholderText("WOLF");
      fireEvent.change(codeInput, { target: { value: "WOLF" } });
      fireEvent.keyDown(codeInput, { key: "Enter" });
      expect(mockPush).toHaveBeenCalledWith("/room/WOLF");
    });

    it("saves name to sessionStorage when name is provided alongside the code", () => {
      render(<Home />);
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Leon/i), {
        target: { value: "Leon" },
      });
      fireEvent.change(screen.getByPlaceholderText("WOLF"), {
        target: { value: "WOLF" },
      });
      fireEvent.click(screen.getByRole("button", { name: /join room/i }));
      expect(sessionStorage.getItem("meld_name")).toBe("Leon");
    });
  });

  describe("error clearing", () => {
    it("clears the error when typing in the name field", () => {
      render(<Home />);
      fireEvent.click(screen.getByRole("button", { name: /create room/i }));
      expect(screen.getByText(/enter your name first/i)).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Leon/i), {
        target: { value: "L" },
      });
      expect(
        screen.queryByText(/enter your name first/i)
      ).not.toBeInTheDocument();
    });

    it("clears the error when typing in the code field", () => {
      render(<Home />);
      fireEvent.change(screen.getByPlaceholderText("WOLF"), {
        target: { value: "AB" },
      });
      fireEvent.click(screen.getByRole("button", { name: /join room/i }));
      expect(
        screen.getByText(/room code must be 4 characters/i)
      ).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText("WOLF"), {
        target: { value: "ABC" },
      });
      expect(
        screen.queryByText(/room code must be 4 characters/i)
      ).not.toBeInTheDocument();
    });
  });
});
