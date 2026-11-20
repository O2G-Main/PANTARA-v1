import { Person, SectionTitle } from "@/components/app/parts";
import type { Member, PerformanceReview, Task } from "@/lib/demo/types";
import { monthName } from "@/lib/hr/overview";
import { reviewScore } from "@/lib/hr/performance";
import { shortDate } from "@/lib/format";

function points(value: number | null) {
  return value === null ? "Belum lengkap" : Math.round(value) + " / 100";
}

function Trend({ month, reviews }: { month: string; reviews: PerformanceReview[] }) {
  const latest = new Map(reviews.map(review => [review.period, reviewScore(review).total]));
  const series = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(month + "-01T12:00:00Z");
    date.setUTCMonth(date.getUTCMonth() - 5 + index);
    const period = date.toISOString().slice(0, 7);
    return { period, score: latest.get(period) ?? null };
  });
  const scored = series.filter(point => point.score !== null);
  const current = series[5].score;
  const previous = series[4].score;
  const delta = current !== null && previous !== null ? Math.round(current) - Math.round(previous) : null;
  return <section className="card spaced"><SectionTitle title="Tren skor" subtitle="Enam bulan hingga periode terpilih" />
    {scored.length < 2 ? <p>{scored.length ? monthName(scored[0].period) + " · " + points(scored[0].score) : "Belum ada skor lengkap dalam periode ini."}</p> : <>
      <svg viewBox="0 0 320 110" width="100%" height="140" aria-hidden="true" className="brand-text">
        {series.map(({ period, score }, i) => {
          if (score === null) return null;
          const x = 10 + i * 60;
          const y = 105 - score;
          const prior = series[i - 1]?.score;
          return <g key={period}>{prior != null && <line x1={x - 60} y1={105 - prior} x2={x} y2={y} stroke="currentColor" strokeWidth="2" />}<circle cx={x} cy={y} r="3" fill="currentColor" /></g>;
        })}
      </svg>
      {delta !== null && <p>{delta === 0 ? "Skor sama dengan bulan sebelumnya." : (delta > 0 ? "Naik " : "Turun ") + Math.abs(delta) + " poin dari bulan sebelumnya."}</p>}
      <details><summary>Nilai per bulan</summary>{series.map(point => <p key={point.period}>{monthName(point.period)} · {point.score === null ? "Belum ada skor lengkap" : points(point.score)}</p>)}</details>
    </>}
  </section>;
}

export function PerformanceDetail({ member, month, reviews, tasks }: { member: Member; month: string; reviews: PerformanceReview[]; tasks: Task[] }) {
  const ownReviews = reviews.filter(review => review.memberId === member.id);
  const review = ownReviews.filter(item => item.period === month).at(-1);
  const result = review && reviewScore(review);
  const finished = tasks.filter(task => task.status === "selesai" && task.assignments.some(a => a.memberId === member.id));
  const monthly = finished.filter(task => task.completedAt?.startsWith(month));
  const undated = finished.filter(task => !task.completedAt).length;
  return <>
    <section className="card spaced"><Person member={member} /><p className="muted">{[member.division, member.team].filter(Boolean).join(" · ") || "Penempatan belum diisi"}</p>
      <SectionTitle title={result ? result.total === null ? "Data belum lengkap" : points(result.total) : "Belum dinilai"} subtitle={monthName(month)} />
      {review && result && <><div className="hr-overview-grid spaced"><div><h3>Skor otomatis</h3><p>{points(review.automaticScore)} · Bobot {review.automaticWeight}%</p>
        <p>Ketepatan waktu · {review.onTimeScore === null ? "Belum lengkap" : Math.round(review.onTimeScore) + "%"}</p><p>Kualitas · {points(review.qualityScore)}</p></div>
        <div><h3>Penilaian manajer</h3><p>{points(result.manual)} · Bobot {100 - review.automaticWeight}%</p>
        {review.criteria.map(item => <p key={item.id}>{item.name} · {points(item.score)} · bobot {item.weight}</p>)}</div></div>
        <h3 className="spaced">Catatan manajer</h3><p>{review.note || "Belum ada catatan."}</p><small>{review.author}</small></>}
    </section>
    <Trend month={month} reviews={ownReviews} />
    <section className="card spaced"><SectionTitle title="Tugas pendukung" subtitle={monthName(month) + " · berdasarkan tanggal selesai"} />
      {undated > 0 && <p className="muted">{undated} tugas selesai belum memiliki tanggal sehingga bulannya belum diketahui.</p>}
      {monthly.length ? <><p>{monthly.filter(t => t.completedAt! <= t.dueDate).length} dari {monthly.length} tugas selesai tepat waktu.</p>
      <div className="table-scroll stack-table"><table><thead><tr><th>Tugas</th><th>Tenggat</th><th>Selesai</th><th>Kualitas</th></tr></thead><tbody>{monthly.map(task => <tr key={task.id}><td>{task.title}</td><td data-label="Tenggat">{shortDate(task.dueDate)}</td><td data-label="Selesai">{shortDate(task.completedAt!)}</td><td data-label="Kualitas">{task.qualityScore ?? "Belum diisi"}</td></tr>)}</tbody></table></div></> : <p>Belum ada tugas dengan tanggal selesai pada bulan ini.</p>}
    </section>
  </>;
}
