import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import HomePage from "./page";

vi.mock("@/features/market-overview/market-dashboard", () => ({
  MarketDashboard: () => <h1>주식 검색 및 시황</h1>,
}));

describe("HomePage", () => {
  it("시장 탐색 화면을 연결한다", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "주식 검색 및 시황" })).toBeInTheDocument();
  });
});
