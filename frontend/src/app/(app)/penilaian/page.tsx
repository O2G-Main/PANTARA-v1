"use client";

import { useState } from "react";
import { DATA_MODE } from "@/lib/api";
import { MonthPicker } from "@/components/hr/month-picker";
import { PageHeading, SectionTitle } from "@/components/app/parts";
import { useDemo } from "@/lib/demo/store";
import { useSession } from "@/lib/session";
import { automaticPerformance, DEFAULT_PERFORMANCE_CONFIG } from "@/lib/hr/performance";

export default function ManagerReview() {
  const { members, tasks, performanceConfig, performanceReviews, today, dispatch } = useDemo();
  const account = useSession();
  const config = performanceConfig ?? DEFAULT_PERFORMANCE_CONFIG;
  const criteria = config.criteria.filter((criterion) => criterion.active);
  const [memberId, setMemberId] = useState("");
  const [period, setPeriod] = useState(today.slice(0, 7));
  const [scores, setScores] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const automatic = automaticPerformance(tasks, memberId, period);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!memberId || !/^\d{4}-\d{2}$/.test(period) || !criteria.length || criteria.some((criterion) => scores[criterion.id] === undefined || scores[criterion.id].trim() === "" || !Number.isFinite(Number(scores[criterion.id])) || Number(scores[criterion.id]) < 0 || Number(scores[criterion.id]) > 100)) {
      setMessage("Pilih anggota dan periode, lalu isi setiap nilai antara 0–100.");
      return;
    }
    if ((performanceReviews ?? []).some((review) => review.memberId === memberId && review.period === period)) {
      setMessage("Penilaian untuk anggota dan periode ini sudah ada.");
      return;
    }
    dispatch({ type: "savePerformanceReview", review: { id: crypto.randomUUID(), memberId, period, note: note.trim(), author: account?.name ?? "Manajer", automaticWeight: config.automaticWeight, automaticScore: automatic.score, onTimeScore: automatic.onTime, qualityScore: automatic.quality, criteria: criteria.map((criterion) => ({ id: criterion.id, name: criterion.name, weight: criterion.weight, score: Number(scores[criterion.id]) })) } });
    setMessage("Penilaian tersimpan.");
  }

  if (DATA_MODE !== "mock") return <section className="card"><p>Penilaian ini tersedia dalam mode demo.</p></section>;

  return <div className="page-enter"><PageHeading title="Penilaian anggota" subtitle="Catat penilaian manajer untuk setiap periode." />
    <section className="card"><SectionTitle title="Penilaian periode" subtitle="Nilai dan bobot tersimpan bersama penilaian." />
      <form className="form-grid" onSubmit={save}>
        <label className="field"><span className="field-label">Anggota</span><select className="select" value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">Pilih anggota</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        <MonthPicker value={period} onChange={setPeriod} />
        <p className="muted full">Otomatis: {automatic.score === null ? "data belum lengkap" : `${Math.round(automatic.score)} / 100`} · Porsi {config.automaticWeight}%</p>
        {criteria.map((criterion) => <label className="field" key={criterion.id}><span className="field-label">{criterion.name} · bobot {criterion.weight}</span><input className="input" type="number" min="0" max="100" value={scores[criterion.id] ?? ""} onChange={(event) => setScores({ ...scores, [criterion.id]: event.target.value })} /></label>)}
        <label className="field full"><span className="field-label">Catatan</span><textarea className="input" rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        {message && <p role="status" className="full">{message}</p>}
        <button type="submit" className="button primary">Simpan penilaian</button>
      </form>
    </section>
  </div>;
}
