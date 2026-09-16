import { render, screen } from "@testing-library/react";

import HomePage from "./page";

describe("HomePage", () => {
  it("제품 이름과 현재 구현 상태를 안내한다", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Stock2" })).toBeInTheDocument();
    expect(screen.getByText("로컬 MVP 기반 준비 완료")).toBeInTheDocument();
  });
});
