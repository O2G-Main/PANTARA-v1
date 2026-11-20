"use client";

import { useState } from "react";
import { PageHeading, SectionTitle } from "@/components/app/parts";
import { useDemo } from "@/lib/demo/store";

export default function HrSettings() {
  const { hrSettings, dispatch } = useDemo();
  const [hours, setHours] = useState<string | null>(null);
  const [reserve, setReserve] = useState<string | null>(null);
  const [message, setMessage] = useState("");
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
  </div>;
}
