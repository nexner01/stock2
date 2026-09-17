"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { LocalUserDataRepository, syncMarketSubscriptions } from "@/composition/browser-user-data";

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  useEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const reload = navigation && "type" in navigation && navigation.type === "reload";
    void (async () => {
      if (reload) {
        await fetch("/api/market/groups/reset", { method: "POST" }).catch(() => undefined);
      }
      await syncMarketSubscriptions(new LocalUserDataRepository(localStorage).load());
      if (reload) await queryClient.invalidateQueries();
    })().catch(() => undefined);
  }, [queryClient]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
