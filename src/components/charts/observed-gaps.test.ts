import { findObservedGaps } from "./observed-gaps";

describe("findObservedGaps", () => {
  it("연속 관측은 유지하고 비어 있는 관측 범위만 반환한다", () => {
    expect(
      findObservedGaps(
        ["2026-09-14T00:00:00Z", "2026-09-15T00:00:00Z", "2026-09-17T00:00:00Z"],
        "1d",
      ),
    ).toEqual([{ after: "2026-09-15T00:00:00Z", before: "2026-09-17T00:00:00Z" }]);
  });
});
