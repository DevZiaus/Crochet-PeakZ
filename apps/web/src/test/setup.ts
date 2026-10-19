import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock next/navigation for tests
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSelectedLayoutSegment: () => null,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
