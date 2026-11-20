import type { Member, PerformanceReview } from "@/lib/demo/types";
import { reviewScore } from "./performance";

export const gaps = {
  division: "Divisi belum diisi",
  availability: "Ketersediaan belum diisi",
  competencies: "Kompetensi belum diisi",
};

export function missing(member: Member, gap: string) {
  switch (gap) {
    case "division": return !member.division?.trim();
    case "availability": return member.availableHours === null;
    case "competencies": return !member.competencies.length;
    default: return true;
  }
}

export const statuses = { complete: "Lengkap", incomplete: "Data belum lengkap", pending: "Belum dinilai" };

export function monthlyResults(members: Member[], reviews: PerformanceReview[], month: string) {
  const latest = new Map(reviews.filter(review => review.period === month).map(review => [review.memberId, review]));
  return members.map(member => {
    const review = latest.get(member.id);
    const score = review ? reviewScore(review).total : null;
    const status = !review ? "pending" : score === null ? "incomplete" : "complete";
    return { member, review, score, status } as const;
  });
}

export function monthName(month: string) {
  return new Date(month + "-01T12:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}
