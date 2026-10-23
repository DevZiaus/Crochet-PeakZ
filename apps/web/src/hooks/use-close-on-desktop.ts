import { useEffect } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Why a drawer is being closed. The distinction matters for focus
 * restoration: a breakpoint crossing hides the trigger that opened the
 * drawer, so the caller has to hand focus to something that is still on
 * screen instead of the trigger.
 */
type CloseReason = "interaction" | "breakpoint";

/**
 * Closes an open mobile drawer when the viewport crosses the desktop
 * breakpoint. The drawer content is hidden by `lg:hidden`, so leaving the Radix
 * dialog open would keep the page inert with focus trapped in a hidden element.
 *
 * `onClose` receives `"breakpoint"` for a resize driven close and
 * `"interaction"` for everything else (Escape, link click, close button), so
 * the caller can restore focus to a target that is actually visible.
 *
 * Only `change` events are handled on purpose. The drawer can only be opened
 * from a trigger that is hidden at desktop width, so an open drawer at that
 * width is always the result of a resize, which fires `change`.
 */
function useCloseOnDesktop(
  open: boolean,
  onClose: (reason: CloseReason) => void,
): void {
  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) onClose("breakpoint");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [onClose, open]);
}

export { useCloseOnDesktop };
export type { CloseReason };
