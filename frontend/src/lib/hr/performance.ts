import type { PerformanceConfig, PerformanceReview, Task } from "@/lib/demo/types";

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  automaticWeight: 50,
  criteria: [
    { id: "collaboration", name: "Kolaborasi", weight: 50, active: true },
    { id: "responsibility", name: "Tanggung jawab", weight: 50, active: true },
  ],
};

export function automaticPerformance(tasks: Task[], memberId: string, period: string) {
  const completed = tasks.filter((task) => task.status === "selesai" && task.completedAt?.startsWith(period) && task.assignments.some((assignment) => assignment.memberId === memberId));
  const missingDates = tasks.some((task) => task.status === "selesai" && !task.completedAt && task.assignments.some((assignment) => assignment.memberId === memberId));
  if (!completed.length || missingDates) return { onTime: null, quality: null, score: null };
  const onTime = completed.filter((task) => task.completedAt! <= task.dueDate).length / completed.length * 100;
  const quality = completed.every((task) => task.qualityScore !== undefined)
    ? completed.reduce((sum, task) => sum + task.qualityScore!, 0) / completed.length : null;
  return { onTime, quality, score: quality === null ? null : (onTime + quality) / 2 };
}

export function reviewScore(review: PerformanceReview) {
  const totalWeight = review.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const manual = totalWeight ? review.criteria.reduce((sum, criterion) => sum + criterion.score * criterion.weight, 0) / totalWeight : null;
  const total = manual === null || review.automaticScore === null ? null : (review.automaticScore * review.automaticWeight + manual * (100 - review.automaticWeight)) / 100;
  return { manual, total };
}
