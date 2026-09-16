import { render, screen } from "@testing-library/react";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it.each([
    ["loading", "불러오는 중"],
    ["healthy", "정상"],
    ["partial", "부분 성공"],
    ["delayed", "응답 지연"],
    ["stale", "오래된 데이터"],
    ["failed", "실패"],
    ["empty", "데이터 없음"],
    ["paused", "장 마감"],
  ] as const)("%s 상태를 문구와 아이콘으로 표시한다", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
