import { CURRENCIES } from "@crochet-peakz/shared";

/**
 * Scaffold landing page for Crochet PeakZ.
 * Imports from @crochet-peakz/shared to prove the workspace link works.
 * Styled with design tokens so it renders correctly in both themes.
 */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background font-sans">
      <main className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 bg-card px-6 py-32">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Crochet PeakZ
        </h1>
        <p className="max-w-md text-center text-lg text-muted-foreground">
          Premium handmade crochet products, patterns, and custom commissions.
        </p>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>
            Currencies: {CURRENCIES.BDT.symbol} {CURRENCIES.BDT.name} ·{" "}
            {CURRENCIES.USD.symbol} {CURRENCIES.USD.name}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Scaffold verified, workspace link to @crochet-peakz/shared is working.
        </p>
      </main>
    </div>
  );
}
