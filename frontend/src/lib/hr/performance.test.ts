import { describe, expect, it } from "vitest";
import { automaticPerformance, reviewScore } from "./performance";
import type { PerformanceReview, Task } from "@/lib/demo/types";

const task = (patch: Partial<Task>): Task => ({
  id: "1", projectId: "p", title: "Tugas", description: "", dueDate: "2026-09-20", priority: "normal", status: "selesai",
  assignments: [{ memberId: "a", hours: 4 }], remainingHours: 0, createdAt: "2026-09-01", competencyIds: [],
  completedAt: "2026-09-20", qualityScore: 80, ...patch,
});

describe("performance", () => {
  it("combines on-time and quality for the selected month and member", () => {
    const result = automaticPerformance([task({}), task({ id: "2", completedAt: "2026-09-21", qualityScore: 60 }), task({ id: "3", completedAt: "2026-10-01" })], "a", "2026-09");
    expect(result).toEqual({ onTime: 50, quality: 70, score: 60 });
  });

  it("keeps the total unavailable when a quality or completion date is missing", () => {
    expect(automaticPerformance([task({ qualityScore: undefined })], "a", "2026-09").score).toBeNull();
    expect(automaticPerformance([task({ completedAt: undefined })], "a", "2026-09").score).toBeNull();
  });

  it("uses saved weights and does not calculate a total with missing data", () => {
    const review: PerformanceReview = { id: "1", memberId: "a", period: "2026-09", author: "Manager", note: "", automaticWeight: 50, automaticScore: 80, onTimeScore: 100, qualityScore: 60, criteria: [{ id: "x", name: "Kerja sama", weight: 1, score: 60 }] };
    expect(reviewScore(review)).toEqual({ manual: 60, total: 70 });
    expect(reviewScore({ ...review, automaticScore: null }).total).toBeNull();
  });
});
