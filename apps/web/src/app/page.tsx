import { CURRENCIES } from "@crochet-peakz/shared";

/**
 * Scaffold landing page for Crochet PeakZ.
 * Imports from @crochet-peakz/shared to prove the workspace link works.
 */
export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-8 py-32 px-16 bg-white dark:bg-black">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
          Crochet PeakZ
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 text-center max-w-md">
          Premium handmade crochet products, patterns, and custom commissions.
        </p>
        <div className="flex gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <span>
            Currencies: {CURRENCIES.BDT.symbol} {CURRENCIES.BDT.name} ·{" "}
            {CURRENCIES.USD.symbol} {CURRENCIES.USD.name}
          </span>
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          Scaffold verified — workspace link to @crochet-peakz/shared is
          working.
        </p>
      </main>
    </div>
  );
}
