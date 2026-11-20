"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeading, Person, SectionTitle } from "@/components/app/parts";
import { useDemo } from "@/lib/demo/store";
import { monthlyResults, monthName, statuses } from "@/lib/hr/overview";
import { updateQuery } from "@/lib/hr/query";

export default function HrHistory() {
  const { members, tasks, performanceReviews = [], today, period } = useDemo();
  const params = useSearchParams();
  const rawMonth = params.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : (period?.start || today).slice(0, 7);
  const query = params.get("q") ?? "";
  const division = params.get("division") ?? "";
  const status = params.get("status") ?? "";
  const divisions = [...new Set(members.map(member => member.division?.trim()).filter((name): name is string => Boolean(name)))];
  const results = monthlyResults(members, performanceReviews, month);
  const selected = results.find(row => row.member.id === params.get("member"));
  const completed = tasks.filter(task => task.status === "selesai" && task.completedAt?.startsWith(month));
  const shown = results.filter(row => (!status || row.status === status) && (!division || row.member.division?.trim() === division) &&
    (row.member.name + " " + row.member.email).toLowerCase().includes(query.trim().toLowerCase()));

  function href(member: string) {
    const next = new URLSearchParams(params);
    next.set("month", month);
    if (member) next.set("member", member);
    else next.delete("member");
    return "/hr/riwayat?" + next;
  }

  return <div className="page-enter"><PageHeading title="Riwayat & performa" subtitle="Tinjau hasil kerja dan dasar penilaian per bulan." />
    <section className="card"><div className="toolbar">
      <label className="field">Bulan penilaian<input type="month" value={month} onChange={event => updateQuery({ month: event.target.value })} /></label>
      {!selected && <><label className="field">Anggota<input type="search" list="hr-member-names" placeholder="Cari nama atau email" value={query} onChange={event => updateQuery({ q: event.target.value })} /></label>
        <datalist id="hr-member-names">{members.map(member => <option key={member.id} value={member.name}>{member.email}</option>)}</datalist>
        <label className="field">Divisi<input list="hr-divisions" placeholder="Semua divisi" value={division} onChange={event => updateQuery({ division: event.target.value })} /></label>
        <datalist id="hr-divisions">{divisions.map(name => <option key={name} value={name} />)}</datalist>
        <label className="field">Status penilaian<select value={status} onChange={event => updateQuery({ status: event.target.value })}><option value="">Semua status</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></>}
    </div></section>
    {selected ? <><Link className="button spaced" href={href("")}>Kembali ke ringkasan</Link>
      <section className="card spaced"><Person member={selected.member} /><p>{statuses[selected.status]} · {monthName(month)}</p></section></> :
    <section className="card spaced"><SectionTitle title="Ringkasan anggota" subtitle={shown.length + " anggota · " + monthName(month)} />
      {shown.length ? <div className="table-scroll stack-table"><table><thead><tr><th>Anggota</th><th>Divisi</th><th>Tugas selesai</th><th>Status penilaian</th><th>Skor</th><th>Aksi</th></tr></thead><tbody>
        {shown.map(({ member, status, score }) => <tr key={member.id}><td><Person member={member} /></td><td data-label="Divisi">{member.division || "Belum diisi"}</td><td data-label="Tugas selesai">{completed.filter(task => task.assignments.some(a => a.memberId === member.id)).length}</td><td data-label="Status">{statuses[status]}</td><td data-label="Skor">{score === null ? "—" : Math.round(score) + " / 100"}</td><td><Link className="button" href={href(member.id)} aria-label={"Lihat detail " + member.name}>Lihat detail</Link></td></tr>)}
      </tbody></table></div> : <p>Tidak ada anggota yang cocok dengan filter ini.</p>}
    </section>}
  </div>;
}
