"use client";

import { useState } from "react";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { PageHeading, SectionTitle } from "@/components/app/parts";
import { DEFAULT_PERFORMANCE_CONFIG } from "@/lib/hr/performance";
import { useDemo } from "@/lib/demo/store";

export default function HrSettings() {
  const { hrSettings, performanceConfig, dispatch } = useDemo();
  const [hours, setHours] = useState<string | null>(null);
  const [reserve, setReserve] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busySettings, setBusySettings] = useState(false);
  const [configDraft, setConfigDraft] = useState<typeof DEFAULT_PERFORMANCE_CONFIG | null>(null);
  const [performanceMessage, setPerformanceMessage] = useState("");
  const [busyPerf, setBusyPerf] = useState(false);
  const config = configDraft ?? performanceConfig ?? DEFAULT_PERFORMANCE_CONFIG;
  const weekly = Number(hours ?? hrSettings?.weeklyHours ?? 40);
  const buffer = Number(reserve ?? hrSettings?.reserveHours ?? 0);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busySettings) return;
    if (!Number.isFinite(weekly) || !Number.isFinite(buffer) || weekly < 0 || weekly > 168 || buffer < 0 || buffer > weekly) {
      setMessage("Pastikan jam kerja antara 0–168 dan cadangan tidak melebihi jam kerja.");
      return;
    }
    if (DATA_MODE === "api") {
      setBusySettings(true);
      setMessage("");
      try {
        const res = await api.hr.updateSettings({ weeklyHours: weekly, reserveHours: buffer });
        dispatch({ type: "setHrSettings", weeklyHours: res.settings.weeklyHours, reserveHours: res.settings.reserveHours });
        setHours(null);
        setReserve(null);
        setMessage("Pengaturan HR tersimpan.");
      } catch (err) {
        setMessage(err instanceof ApiError ? err.message : "Gagal menyimpan pengaturan HR.");
      } finally {
        setBusySettings(false);
      }
      return;
    }
    dispatch({ type: "setHrSettings", weeklyHours: weekly, reserveHours: buffer });
    setMessage("Pengaturan HR tersimpan.");
  }

  async function savePerformance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyPerf) return;
    const active = config.criteria.filter((criterion) => criterion.active);
    if (!active.length || active.some((criterion) => !criterion.name.trim() || criterion.weight < 0) || !active.some((criterion) => criterion.weight > 0) || config.automaticWeight < 0 || config.automaticWeight > 100) {
      setPerformanceMessage("Isi nama dan bobot kriteria aktif, serta porsi otomatis 0–100.");
      return;
    }
    if (DATA_MODE === "api") {
      setBusyPerf(true);
      setPerformanceMessage("");
      try {
        const res = await api.hr.updatePerformanceConfig(config);
        dispatch({ type: "performanceConfig", config: res.config });
        setConfigDraft(null);
        setPerformanceMessage("Kriteria tersimpan untuk penilaian berikutnya.");
      } catch (err) {
        setPerformanceMessage(err instanceof ApiError ? err.message : "Gagal menyimpan kriteria performa.");
      } finally {
        setBusyPerf(false);
      }
      return;
    }
    dispatch({ type: "performanceConfig", config });
    setPerformanceMessage("Kriteria tersimpan untuk penilaian berikutnya.");
  }

  return <div className="page-enter">
    <PageHeading title="Pengaturan HR" subtitle="Atur standar jam kerja dan cadangan untuk tugas mendadak." />
    <section className="card"><SectionTitle title="Jam kerja karyawan" subtitle="Standar ini dapat disesuaikan pada profil masing-masing anggota." />
      <form onSubmit={(e) => void save(e)} className="form-grid">
        <label className="field"><span className="field-label">Jam kerja standar per minggu</span><input className="input" type="number" min="0" max="168" required value={hours ?? hrSettings?.weeklyHours ?? 40} onChange={(event) => { setHours(event.target.value); setMessage(""); }} /></label>
        <label className="field"><span className="field-label">Cadangan per minggu</span><input className="input" type="number" min="0" max="168" required value={reserve ?? hrSettings?.reserveHours ?? 0} onChange={(event) => { setReserve(event.target.value); setMessage(""); }} /></label>
        <p className="muted full">Kapasitas yang dapat direncanakan: {Math.max(0, weekly - buffer)} jam per minggu. Cadangan termasuk dalam jam kerja.</p>
        {message && <p className="full" role="status">{message}</p>}
        <button className="button primary" type="submit" disabled={busySettings}>{busySettings ? "Menyimpan..." : "Simpan pengaturan"}</button>
      </form>
    </section>
    <section className="card spaced"><SectionTitle title="Kriteria performa" subtitle="Atur porsi skor otomatis dan penilaian manajer." />
      <form onSubmit={(e) => void savePerformance(e)} className="form-grid">
        <label className="field full"><span className="field-label">Porsi otomatis (%)</span><input className="input" type="number" min="0" max="100" required value={config.automaticWeight} onChange={(event) => setConfigDraft({ ...config, automaticWeight: Number(event.target.value) })} /><span className="field-hint">Porsi manajer {100 - config.automaticWeight}%. Bobot kriteria dinormalisasi secara otomatis.</span></label>
        {config.criteria.map((criterion, index) => <div className="field full" key={criterion.id}><div className="toolbar">
          <label className="field"><span className="field-label">Nama kriteria</span><input className="input" value={criterion.name} onChange={(event) => setConfigDraft({ ...config, criteria: config.criteria.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} /></label>
          <label className="field"><span className="field-label">Bobot</span><input className="input" type="number" min="0" max="100" value={criterion.weight} onChange={(event) => setConfigDraft({ ...config, criteria: config.criteria.map((item, i) => i === index ? { ...item, weight: Number(event.target.value) } : item) })} /></label>
          <label><input type="checkbox" checked={criterion.active} onChange={(event) => setConfigDraft({ ...config, criteria: config.criteria.map((item, i) => i === index ? { ...item, active: event.target.checked } : item) })} /> Aktif</label>
        </div></div>)}
        <button className="button" type="button" onClick={() => setConfigDraft({ ...config, criteria: [...config.criteria, { id: crypto.randomUUID(), name: "", weight: 1, active: true }] })}>Tambah kriteria</button>
        <button className="button primary" type="submit" disabled={busyPerf}>{busyPerf ? "Menyimpan..." : "Simpan kriteria"}</button>
        {performanceMessage && <p className="full" role="status">{performanceMessage}</p>}
      </form>
    </section>
  </div>;
}
