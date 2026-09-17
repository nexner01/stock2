"use client";

import { useState } from "react";

import type { MarketOverviewDto } from "@/contracts";

export function GroupStatusNotice({
  group,
  pollIntervalSeconds,
  timeoutSeconds,
  onRetry,
}: Readonly<{
  group: MarketOverviewDto["groups"][number];
  pollIntervalSeconds: number;
  timeoutSeconds: number;
  onRetry(): Promise<void>;
}>) {
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  if (!["partial", "delayed", "stale", "failed"].includes(group.status)) return null;
  const lastHealthy = group.lastHealthyAt
    ? `${group.lastHealthyAt.slice(0, 16).replace("T", " ")} UTC`
    : "없음";
  const detail =
    group.status === "partial"
      ? `성공 ${group.batches.successful}개·실패 ${group.batches.failed}개 배치의 결과만 표시합니다.`
      : group.status === "delayed"
        ? `${timeoutSeconds}초 타임아웃으로 이 그룹의 ${group.skipped}개 회차를 건너뛰었습니다.`
        : group.status === "stale"
          ? "새 데이터를 받지 못해 마지막 정상 데이터를 표시합니다."
          : group.stopped
            ? `${group.consecutiveFailures}회 연속 실패해 이 그룹의 자동 조회가 중단되었습니다.`
            : `${group.consecutiveFailures}회 연속 실패했습니다. 다음 고정 조회 시각에 자동으로 다시 시도합니다.`;

  async function retry() {
    setRetrying(true);
    setRetryFailed(false);
    try {
      await onRetry();
    } catch {
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="error-state" role={group.status === "failed" ? "alert" : "status"}>
      <div>
        <strong>
          {group.status === "partial"
            ? "일부 데이터만 갱신했습니다."
            : "데이터 갱신에 문제가 있습니다."}
        </strong>
        <p>
          {detail} 마지막 정상 갱신: {lastHealthy}. 적용 조회 주기: {pollIntervalSeconds}초.
        </p>
        {retryFailed ? <p>다시 시작하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.</p> : null}
      </div>
      <button disabled={retrying} onClick={() => void retry()}>
        {retrying ? "다시 시작 중…" : "이 그룹 다시 시도"}
      </button>
    </div>
  );
}
