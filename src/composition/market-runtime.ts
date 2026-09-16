/**
 * Application composition root.
 *
 * Route handlers depend on this narrow assembly boundary instead of importing
 * concrete provider, scheduler, and persistence adapters directly.
 */
export { ensureMarketRuntime, marketRuntime } from "@/infrastructure/runtime/market-runtime";
