"use client";

import type { ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Applies the light or dark design token set by setting `data-theme` on the html element.
 * Defaults to the system preference and falls back to light before hydration.
 * @param props - Passed through to next-themes' provider.
 * @returns The provider wrapping the app tree.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
