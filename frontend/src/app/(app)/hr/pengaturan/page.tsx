"use client";

import { useState } from "react";
import { DATA_MODE } from "@/lib/api";
import { PageHeading, SectionTitle } from "@/components/app/parts";
import { DEFAULT_PERFORMANCE_CONFIG } from "@/lib/hr/performance";
import { useDemo } from "@/lib/demo/store";

export default function HrSettings() {
  const { hrSettings, performanceConfig, dispatch } = useDemo();
  const [hours, setHours] = useState<string | null>(null);
  const [reserve, setReserve] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [configDraft, setConfigDraft] = useState<typeof DEFAULT_PERFORMANCE_CONFIG | null>(null);
  const [performanceMessage, setPerformanceMessage] = useState("");
  const config = configDraft ?? performanceConfig ?? DEFAULT_PERFORMANCE_CONFIG;
  const weekly = Number(hours ?? hrSettings?.weeklyHours ?? 40);
  const buffer = Number(reserve ?? hrSettings?.reserveHours ?? 0);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isFinite(weekly) || !Number.isFinite(buffer) || weekly < 0 || weekly > 168 || buffer < 0 || buffer > weekly) {
      setMessage("Pastikan jam kerja antara 0–168 dan cadangan tidak melebihi jam kerja.");
      return;
    }
    dispatch({ type: "setHrSettings", weeklyHours: weekly, reserveHours: buffer });
    setMessage("Pengaturan HR tersimpan.");
  }

  return <div className="page-enter">
    <PageHeading title="Pengaturan HR" subtitle="Atur standar jam kerja dan cadangan untuk tugas mendadak." />
    <section className="card"><SectionTitle title="Jam kerja karyawan" subtitle="Standar ini dapat disesuaikan pada profil masing-masing anggota." />
      <form onSubmit={save} className="form-grid">
        <label className="field"><span className="field-label">Jam kerja standar per minggu</span><input className="input" type="number" min="0" max="168" required value={hours ?? hrSettings?.weeklyHours ?? 40} onChange={(event) => { setHours(event.target.value); setMessage(""); }} /></label>
        <label className="field"><span className="field-label">Cadangan per minggu</span><input className="input" type="number" min="0" max="168" required value={reserve ?? hrSettings?.reserveHours ?? 0} onChange={(event) => { setReserve(event.target.value); setMessage(""); }} /></label>
        <p className="muted full">Kapasitas yang dapat direncanakan: {Math.max(0, weekly - buffer)} jam per minggu. Cadangan termasuk dalam jam kerja.</p>
        {message && <p className="full" role="status">{message}</p>}
        <button className="button primary" type="submit">Simpan pengaturan</button>
      </form>
    </section>
    {DATA_MODE === "mock" && <section className="card spaced"><SectionTitle title="Kriteria performa" subtitle="Atur porsi skor otomatis dan penilaian manajer." />
      <form onSubmit={(event) => { event.preventDefault(); const active = config.criteria.filter((criterion) => criterion.active); if (!active.length || active.some((criterion) => !criterion.name.trim() || criterion.weight < 0) || !active.some((criterion) => criterion.weight > 0) || config.automaticWeight < 0 || config.automaticWeight > 100) { setPerformanceMessage("Isi nama dan bobot kriteria aktif, serta porsi otomatis 0–100."); return; } dispatch({ type: "performanceConfig", config }); setPerformanceMessage("Kriteria tersimpan untuk penilaian berikutnya."); }} className="form-grid">
        <label className="field full"><span className="field-label">Porsi otomatis (%)</span><input className="input" type="number" min="0" max="100" required value={config.automaticWeight} onChange={(event) => setConfigDraft({ ...config, automaticWeight: Number(event.target.value) })} /><span className="field-hint">Porsi manajer {100 - config.automaticWeight}%. Bobot kriteria dinormalisasi secara otomatis.</span></label>
        {config.criteria.map((criterion, index) => <div className="field full" key={criterion.id}><div className="toolbar">
          <label className="field"><span className="field-label">Nama kriteria</span><input className="input" value={criterion.name} onChange={(event) => setConfigDraft({ ...config, criteria: config.criteria.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} /></label>
          <label className="field"><span className="field-label">Bobot</span><input className="input" type="number" min="0" max="100" value={criterion.weight} onChange={(event) => setConfigDraft({ ...config, criteria: config.criteria.map((item, i) => i === index ? { ...item, weight: Number(event.target.value) } : item) })} /></label>
          <label><input type="checkbox" checked={criterion.active} onChange={(event) => setConfigDraft({ ...config, criteria: config.criteria.map((item, i) => i === index ? { ...item, active: event.target.checked } : item) })} /> Aktif</label>
        </div></div>)}
        <button className="button" type="button" onClick={() => setConfigDraft({ ...config, criteria: [...config.criteria, { id: crypto.randomUUID(), name: "", weight: 1, active: true }] })}>Tambah kriteria</button>
        <button className="button primary" type="submit">Simpan kriteria</button>
        {performanceMessage && <p className="full" role="status">{performanceMessage}</p>}
      </form>
    </section>}
  </div>;
}
