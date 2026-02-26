import "@testing-library/jest-dom";

// Stub clipboard API (not available in jsdom)
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});
