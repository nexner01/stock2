import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle } from "lucide-react";

const labels = {
  loading: "불러오는 중",
  healthy: "정상",
  partial: "부분 성공",
  delayed: "응답 지연",
  stale: "오래된 데이터",
  failed: "실패",
  empty: "데이터 없음",
  paused: "장 마감",
} as const;

export function StatusBadge({ status }: Readonly<{ status: keyof typeof labels }>) {
  const Icon =
    status === "healthy"
      ? CheckCircle2
      : status === "loading"
        ? LoaderCircle
        : status === "paused"
          ? Clock3
          : AlertTriangle;
  return (
    <span className={`status-badge status-badge--${status}`}>
      <Icon aria-hidden="true" size={13} />
      {labels[status]}
    </span>
  );
}
