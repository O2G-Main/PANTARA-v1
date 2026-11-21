import { CountUp } from "./count-up";
import { statuses, type monthlyResults } from "@/lib/hr/overview";
import type { Task } from "@/lib/demo/types";

export function MonthlySummary({ rows, tasks, status, select }: {
  rows: ReturnType<typeof monthlyResults>; tasks: Task[]; status: string; select: (status: string) => void;
}) {
  const counts = { complete: 0, incomplete: 0, pending: 0 };
  for (const row of rows) counts[row.status]++;
  const percent = (count: number) => rows.length ? count * 100 / rows.length : 0;
  const complete = percent(counts.complete);
  const partial = complete + percent(counts.incomplete);
  const timely = tasks.filter(task => task.completedAt!.slice(0, 10) <= task.dueDate.slice(0, 10)).length;
  return <div className="hr-overview-grid spaced">
    <section className="card"><h2>Progres penilaian</h2><div className="hr-ring-row">
      <div className="hr-ring" aria-label={rows.length ? Math.round(complete) + "% lengkap" : "Belum ada anggota"} style={{background: `conic-gradient(#11776e ${complete}%, #d09427 0 ${partial}%, #d9dfde 0)`}}>
        <strong>{rows.length ? Math.round(complete) + "%" : "—"}</strong></div>
      <div>{(Object.keys(statuses) as (keyof typeof statuses)[]).map(key => <button key={key} className="hr-legend" data-status={key} aria-pressed={status === key} onClick={() => select(status === key ? "" : key)}><i />{statuses[key]} <b>{counts[key]}</b></button>)}</div>
    </div></section>
    <section className="card"><h2>Tugas selesai</h2><div className="hr-task-count"><CountUp value={tasks.length} /></div>
      <progress aria-label="Tugas selesai tepat waktu" max={tasks.length || 1} value={timely} /><p className="muted">{tasks.length ? timely + " dari " + tasks.length + " tugas selesai tepat waktu" : "Belum ada tugas selesai pada periode ini."}</p></section>
  </div>;
}
