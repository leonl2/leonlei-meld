import "@testing-library/jest-dom";
import { vi } from "vitest";

// Stub clipboard API (not available in jsdom)
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});
