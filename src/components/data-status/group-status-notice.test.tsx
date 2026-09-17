import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { MarketOverviewDto } from "@/contracts";

import { GroupStatusNotice } from "./group-status-notice";

const group = (
  status: MarketOverviewDto["groups"][number]["status"],
): MarketOverviewDto["groups"][number] => ({
  id: "watchlist",
  status,
  lastHealthyAt: "2026-09-16T01:00:01Z",
  skipped: 2,
  consecutiveFailures: status === "failed" ? 4 : 1,
  stopped: status === "failed",
  batches: { total: 2, successful: 1, failed: 1 },
  values: [],
});

describe("GroupStatusNotice", () => {
  it("부분 성공 배치와 마지막 정상 시각을 안내한다", () => {
    render(
      <GroupStatusNotice
        group={group("partial")}
        pollIntervalSeconds={2}
        timeoutSeconds={5}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("성공 1개·실패 1개 배치");
    expect(screen.getByRole("status")).toHaveTextContent("2026-09-16 01:00 UTC");
  });

  it("지연 원인·skip·설정을 표시하고 해당 그룹만 다시 시도한다", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    render(
      <GroupStatusNotice
        group={group("delayed")}
        pollIntervalSeconds={2}
        timeoutSeconds={5}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("5초 타임아웃");
    expect(screen.getByRole("status")).toHaveTextContent("2개 회차");
    expect(screen.getByRole("status")).toHaveTextContent("적용 조회 주기: 2초");
    await userEvent.click(screen.getByRole("button", { name: "이 그룹 다시 시도" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
