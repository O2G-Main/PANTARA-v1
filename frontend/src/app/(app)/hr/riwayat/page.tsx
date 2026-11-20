"use client";

import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Icon } from "@/components/ui";
import { PageHeading, Person, SectionTitle } from "@/components/app/parts";
import { useDemo } from "@/lib/demo/store";
import { reviewScore } from "@/lib/hr/performance";
import { shortDate } from "@/lib/format";

export default function HrHistory() {
  const { members, tasks, performanceReviews = [] } = useDemo();
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("");
  const member = members.find((item) => item.id === selected);
  const divisions = [...new Set(members.map((item) => item.division?.trim()).filter((item): item is string => Boolean(item)))];
  const shown = members.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase()) && (!division || item.division === division));
  const reviews = performanceReviews.filter((review) => review.memberId === selected).sort((a, b) => b.period.localeCompare(a.period));
  const history = tasks.filter((task) => task.assignments.some((assignment) => assignment.memberId === selected));

  return <div className="page-enter">
    <PageHeading title="Riwayat & performa" subtitle="Tinjau konteks kerja dan penilaian setiap anggota." />
    {!member ? <section className="card"><SectionTitle title="Ringkasan anggota" subtitle="Pilih anggota untuk melihat rincian riwayat dan penilaian." />
      <div className="toolbar"><label className="search-field"><Icon icon={Search} size={16} /><span className="sr-only">Cari anggota</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau email" /></label>
        <label className="filter-select"><span className="sr-only">Divisi</span><select value={division} onChange={(event) => setDivision(event.target.value)}><option value="">Semua divisi</option>{divisions.map((name) => <option key={name}>{name}</option>)}</select></label></div>
      <div className="table-scroll stack-table spaced"><table><thead><tr><th>Anggota</th><th>Divisi</th><th>Tugas selesai</th><th>Penilaian terakhir</th><th>Aksi</th></tr></thead><tbody>
        {shown.map((item) => { const last = performanceReviews.filter((review) => review.memberId === item.id).sort((a, b) => b.period.localeCompare(a.period))[0]; const result = last ? reviewScore(last).total : null; return <tr key={item.id}><td><Person member={item} /></td><td data-label="Divisi">{item.division || "Belum diisi"}</td><td data-label="Tugas selesai">{tasks.filter((task) => task.status === "selesai" && task.assignments.some((assignment) => assignment.memberId === item.id)).length}</td><td data-label="Penilaian">{last ? result === null ? "Data belum lengkap" : `${Math.round(result)} / 100 · ${last.period}` : "Belum dinilai"}</td><td><button className="button" onClick={() => setSelected(item.id)}>Lihat detail</button></td></tr>; })}
      </tbody></table></div>{!shown.length && <p className="muted spaced">Tidak ada anggota yang cocok.</p>}
    </section> : <>
      <button className="button spaced" onClick={() => setSelected("")}><Icon icon={ArrowLeft} />Kembali ke ringkasan</button>
      <section className="card spaced"><SectionTitle title={member.name} subtitle={`${member.role} · ${member.division || "Divisi belum diisi"} · ${member.team || "Tim belum diisi"}`} />
        <p className="muted">Kompetensi: {member.competencies.length} · Ketersediaan: {member.availableHours === null ? "belum diisi" : `${member.availableHours} jam`}</p>
      </section>
      <section className="card spaced"><SectionTitle title="Penilaian per periode" subtitle="Rincian skor dan catatan manajer pada saat penilaian." />
        {reviews.length ? reviews.map((review) => { const result = reviewScore(review); return <div key={review.id} className="spaced"><h3>{review.period} · {result.total === null ? "Data belum lengkap" : `${Math.round(result.total)} / 100`}</h3><p className="muted">Otomatis {review.automaticScore === null ? "belum lengkap" : Math.round(review.automaticScore)} · Manajer {result.manual === null ? "belum lengkap" : Math.round(result.manual)} · Porsi otomatis {review.automaticWeight}%</p><p className="muted">Tepat waktu: {review.onTimeScore === null ? "belum lengkap" : `${Math.round(review.onTimeScore)}%`} · Kualitas: {review.qualityScore === null ? "belum lengkap" : Math.round(review.qualityScore)}</p>{review.criteria.map((criterion) => <p key={criterion.id}>{criterion.name}: {criterion.score} / 100 · bobot {criterion.weight}</p>)}<p className="muted">{review.author}{review.note ? ` · ${review.note}` : ""}</p></div>; }) : <p className="muted">Belum ada penilaian manajer.</p>}
      </section>
      <section className="card spaced"><SectionTitle title="Riwayat tugas" subtitle={`${history.length} tugas tercatat`} />
        {history.length ? <div className="table-scroll stack-table"><table><thead><tr><th>Tugas</th><th>Status</th><th>Tenggat</th><th>Selesai</th><th>Kualitas</th></tr></thead><tbody>{history.map((task) => <tr key={task.id}><td>{task.title}</td><td data-label="Status">{task.status}</td><td data-label="Tenggat">{shortDate(task.dueDate)}</td><td data-label="Selesai">{task.completedAt ? shortDate(task.completedAt) : "—"}</td><td data-label="Kualitas">{task.qualityScore ?? "—"}</td></tr>)}</tbody></table></div> : <p className="muted">Belum ada riwayat tugas.</p>}
      </section>
    </>}
  </div>;
}
