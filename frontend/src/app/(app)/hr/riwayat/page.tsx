"use client";

import { MonthlySummary } from "@/components/hr/monthly-summary";
import { MonthPicker } from "@/components/hr/month-picker";
import { Choice, FilterCombobox } from "@/components/hr/filter-combobox";
import { PerformanceDetail } from "@/components/hr/performance-detail";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeading, Person, SectionTitle } from "@/components/app/parts";
import { PERIOD } from "@/lib/demo/seed";
import { useDemo } from "@/lib/demo/store";
import { monthlyResults, monthName, statuses } from "@/lib/hr/overview";
import { updateQuery } from "@/lib/hr/query";

export default function HrHistory() {
  const { members, tasks, performanceReviews = [], period } = useDemo();
  const params = useSearchParams();
  const rawMonth = params.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : (period?.start || PERIOD.start).slice(0, 7);
  const query = params.get("q") ?? "";
  const division = params.get("division") ?? "";
  const status = params.get("status") ?? "";
  const divisions = [...new Set(members.map(member => member.division?.trim()).filter((name): name is string => Boolean(name)))];
  const results = monthlyResults(members, performanceReviews, month);
  const selected = results.find(row => row.member.id === params.get("member"));
  const completed = tasks.filter(task => task.status === "selesai" && task.completedAt?.startsWith(month));
  const scoped = results.filter(row => (!division || row.member.division?.trim() === division) &&
    (row.member.name + " " + row.member.email).toLowerCase().includes(query.trim().toLowerCase()));

  const shown = scoped.filter(row => !status || row.status === status);
  const ids = new Set(scoped.map(row => row.member.id));
  const scopedTasks = completed.filter(task => task.assignments.some(a => ids.has(a.memberId)));

  function href(member: string) {
    const next = new URLSearchParams(params);
    next.set("month", month);
    if (member) next.set("member", member);
    else next.delete("member");
    return "/hr/riwayat?" + next;
  }

  return <div className="page-enter"><PageHeading title="Riwayat & performa" subtitle="Tinjau hasil kerja dan dasar penilaian per bulan." />
    <section className="card"><div className="toolbar">
      <MonthPicker value={month} onChange={month => updateQuery({ month })} />
      {!selected && <><FilterCombobox label="Anggota" placeholder="Cari nama atau email" options={members.map(member => ({ label: member.name, detail: member.email }))} value={query} onChange={q => updateQuery({ q })} />
        <FilterCombobox label="Divisi" placeholder="Semua divisi" options={divisions.map(label => ({ label }))} value={division} onChange={division => updateQuery({ division })} />
        <Choice label="Status penilaian" choices={{ "": "Semua status", ...statuses }} value={status} onChange={status => updateQuery({ status })} /></>}
    </div></section>
    {!selected && <MonthlySummary rows={scoped} tasks={scopedTasks} status={status} select={status => updateQuery({ status })} />}
    {selected ? <><Link className="button spaced" href={href("")}>Kembali ke ringkasan</Link>
      <PerformanceDetail member={selected.member} month={month} reviews={performanceReviews} tasks={tasks} /></> :
    <section className="card spaced"><SectionTitle title="Ringkasan anggota" subtitle={shown.length + " anggota · " + monthName(month)} />
      {shown.length ? <div className="hr-people-grid">
        {shown.map(({ member, status, score }) => <Link key={member.id} className="hr-person-card" href={href(member.id)}>
          <Person member={member} /><p className="muted">{member.employmentType === "freelancer" ? "Freelancer" : "Karyawan"} · {member.division || "Divisi belum diisi"}</p>
          <p>{completed.filter(task => task.assignments.some(a => a.memberId === member.id)).length} tugas selesai</p>
          <div className="hr-card-result"><span data-status={status}>{statuses[status]}</span>{score !== null && <strong>{Math.round(score)} / 100</strong>}</div>
        </Link>)}</div> : <p>Tidak ada anggota yang cocok dengan filter ini.</p>}
    </section>}
  </div>;
}
