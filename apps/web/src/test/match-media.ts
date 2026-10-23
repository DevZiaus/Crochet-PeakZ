import { vi } from "vitest";

/**
 * Replaces `window.matchMedia` with a controllable mock. `crossToDesktop`
 * fires the change listener the same way a real viewport resize would.
 */
function mockDesktopBreakpoint() {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const spy = vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => {
          listeners.add(listener);
        },
        removeEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => {
          listeners.delete(listener);
        },
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );

  return {
    crossToDesktop: () => {
      for (const listener of listeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    },
    restore: () => {
      spy.mockRestore();
    },
  };
}

export { mockDesktopBreakpoint };
