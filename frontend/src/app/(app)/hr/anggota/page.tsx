"use client";

import { useState } from "react";
import { FileSpreadsheet, Plus, Search, Upload } from "lucide-react";
import { PageHeading, Person } from "@/components/app/parts";
import { Icon, Modal } from "@/components/ui";
import { useDemo } from "@/lib/demo/store";
import type { Member } from "@/lib/demo/types";

export default function HrMembers() {
  const { members, hrSettings, dispatch } = useDemo();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("semua");
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const shown = members.filter((member) => {
    const matches = [member.name, member.role, member.team, member.division].join(" ").toLowerCase().includes(query.toLowerCase());
    return matches && (filter === "semua" || (member.employmentType ?? "karyawan") === filter);
  });

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    if (!editing.name.trim() || !/^\S+@\S+\.\S+$/.test(editing.email) || !editing.role.trim()) {
      setError("Isi nama, jabatan, dan email yang valid.");
      return;
    }
    if (members.some((member) => member.id !== editing.id && member.email.toLowerCase() === editing.email.toLowerCase())) {
      setError("Email sudah digunakan anggota lain.");
      return;
    }
    const workHours = editing.workHoursOverride ?? hrSettings?.weeklyHours ?? 40;
    const reserveHours = editing.reserveHoursOverride ?? hrSettings?.reserveHours ?? 0;
    if (editing.employmentType !== "freelancer" && reserveHours > workHours) {
      setError("Cadangan tidak boleh melebihi jam kerja.");
      return;
    }
    const name = editing.name.trim();
    dispatch({ type: "upsertMember", member: { ...editing, name, email: editing.email.trim().toLowerCase(), initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() } });
    setEditing(null);
  }

  async function loadCsv(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Pilih file berformat CSV.");
      return;
    }
    try {
      const text = await file.text();
      setCsv(text);
      setFileName(file.name);
      setError("");
    } catch {
      setError("File tidak dapat dibaca. Coba pilih ulang file.");
    }
  }

  function importMembers() {
    const lines = csv.trim().split(/\r?\n/);
    if (lines.shift()?.trim().toLowerCase() !== "nama,email,jabatan,jenis,tim,divisi,jam") {
      setError("Header harus: nama,email,jabatan,jenis,tim,divisi,jam.");
      return;
    }
    const emails = new Set(members.map((member) => member.email.toLowerCase()));
    const imported: Member[] = [];
    for (const [index, line] of lines.entries()) {
      const fields = line.split(",").map((field) => field.trim());
      const [name, email, role, employmentType, team, division, hours] = fields;
      if (fields.length !== 7 || !name || !role || !/^\S+@\S+\.\S+$/.test(email) || !["karyawan", "freelancer"].includes(employmentType) || !hours || !Number.isFinite(Number(hours)) || Number(hours) < 0 || Number(hours) > 168 || emails.has(email.toLowerCase())) {
        setError(`Periksa baris ${index + 2}. Pastikan kolom lengkap, jam valid, dan email belum digunakan.`);
        return;
      }
      emails.add(email.toLowerCase());
      imported.push({ id: crypto.randomUUID(), name, email: email.toLowerCase(), role, employmentType: employmentType as "karyawan" | "freelancer", team, division, weeklyLimit: Number(hours), initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(), availableHours: null, leaveDates: [], competencies: [], prefers: [], avoids: [], access: "anggota" });
    }
    if (!imported.length) {
      setError("Tambahkan setidaknya satu baris anggota.");
      return;
    }
    imported.forEach((member) => dispatch({ type: "upsertMember", member }));
    setMessage(`${imported.length} anggota berhasil diimpor.`);
    setImportOpen(false);
    setCsv("");
    setFileName("");
    setError("");
  }

  function add() {
    setError("");
    setEditing({ id: crypto.randomUUID(), name: "", initials: "", email: "", role: "", employmentType: "karyawan", team: "", division: "", availableHours: null, weeklyLimit: 40, leaveDates: [], competencies: [], prefers: [], avoids: [], access: "anggota" });
  }

  return <div className="page-enter">
    <PageHeading title="Anggota" subtitle="Kelola profil kerja dan data anggota organisasi." actions={<><button className="button" onClick={() => { setError(""); setImportOpen(true); }}>Impor anggota</button><button className="button primary" onClick={add}><Icon icon={Plus} />Tambah anggota</button></>} />
    {message && <p role="status">{message}</p>}
    <section className="card">
      <div className="toolbar">
        <label className="search-field"><Icon icon={Search} size={16} /><span className="sr-only">Cari anggota</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, jabatan, tim, atau divisi" /></label>
        <label className="filter-select"><span className="sr-only">Jenis hubungan kerja</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="semua">Semua jenis</option><option value="karyawan">Karyawan</option><option value="freelancer">Freelancer</option></select></label>
      </div>
      <div className="table-scroll stack-table spaced"><table><thead><tr><th>Anggota</th><th>Jenis</th><th>Tim</th><th>Divisi</th><th>Jam kerja</th><th>Aksi</th></tr></thead><tbody>
        {shown.map((member) => <tr key={member.id}><td><Person member={member} /></td><td data-label="Jenis">{member.employmentType === "freelancer" ? "Freelancer" : "Karyawan"}</td><td data-label="Tim">{member.team || "Belum diisi"}</td><td data-label="Divisi">{member.division || "Belum diisi"}</td><td data-label="Jam kerja">{member.weeklyLimit} jam/minggu</td><td><button className="button" onClick={() => { setError(""); setEditing(member); }}>Ubah profil</button></td></tr>)}
      </tbody></table></div>
      {!shown.length && <p>Tidak ada anggota yang cocok.</p>}
    </section>
    {importOpen && <Modal title="Impor anggota" onClose={() => setImportOpen(false)}>
      <div className="hr-import">
        <p className="muted">Tambahkan beberapa anggota sekaligus menggunakan file CSV.</p>
        <label className={`hr-cv-upload${dragging ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void loadCsv(file); }}>
          <span className="hr-cv-icon"><Icon icon={Upload} size={21} /></span>
          <strong>{fileName || "Tarik file CSV ke sini"}</strong>
          <span className="muted">{fileName ? "File siap diperiksa dan diedit di bawah." : "Pilih file CSV berisi data anggota."}</span>
          <span className="hr-cv-button">{fileName ? "Ganti file" : "Pilih file"}</span>
          <input className="hr-cv-input" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadCsv(file); event.target.value = ""; }} />
        </label>
        <div className="hr-import-guide"><Icon icon={FileSpreadsheet} size={18} /><div><strong>Format file</strong><p className="muted">Kolom: nama, email, jabatan, jenis, tim, divisi, jam. Jenis diisi karyawan atau freelancer. Hindari koma di dalam isi kolom.</p><a className="inline-link" href={"data:text/csv;charset=utf-8," + encodeURIComponent("nama,email,jabatan,jenis,tim,divisi,jam\nSari,sari@example.com,Analis,karyawan,Operasional,Umum,40\n")} download="template-anggota.csv">Unduh template CSV</a></div></div>
        <label className="field"><span className="field-label">Data CSV</span><textarea className="input" rows={5} value={csv} onChange={(event) => { setCsv(event.target.value); setError(""); }} placeholder={"nama,email,jabatan,jenis,tim,divisi,jam\nSari,sari@example.com,Analis,karyawan,Operasional,Umum,40"} /><span className="field-hint">Data dapat ditempel atau diedit sebelum diimpor.</span></label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="hr-import-actions"><button className="button" type="button" onClick={() => setImportOpen(false)}>Batal</button><button className="button primary" type="button" onClick={importMembers} disabled={!csv.trim()}>Impor anggota</button></div>
      </div>
    </Modal>}
    {editing && <Modal title="Profil kerja anggota" onClose={() => setEditing(null)}><form onSubmit={save} className="form-grid">
      {([["name", "Nama lengkap"], ["email", "Email"], ["role", "Jabatan"], ["team", "Tim"], ["division", "Divisi"]] as const).map(([key, label]) => <label className="field full" key={key}><span className="field-label">{label}</span><input className="input" value={editing[key] ?? ""} onChange={(event) => setEditing({ ...editing, [key]: event.target.value })} /></label>)}
      <label className="field"><span className="field-label">Jenis hubungan kerja</span><select className="input" value={editing.employmentType ?? "karyawan"} onChange={(event) => setEditing({ ...editing, employmentType: event.target.value as "karyawan" | "freelancer" })}><option value="karyawan">Karyawan</option><option value="freelancer">Freelancer</option></select></label>
      {editing.employmentType === "freelancer" ? <>
        <label className="field"><span className="field-label">Jam disepakati per minggu</span><input className="input" type="number" min="0" max="168" required value={editing.weeklyLimit} onChange={(event) => setEditing({ ...editing, weeklyLimit: Number(event.target.value) })} /></label>
        <label className="field"><span className="field-label">Ketersediaan periode aktif</span><input className="input" type="number" min="0" max="168" value={editing.availableHours ?? ""} onChange={(event) => setEditing({ ...editing, availableHours: event.target.value === "" ? null : Number(event.target.value) })} /></label>
      </> : <>
        <label className="field"><span className="field-label">Jam kerja khusus (opsional)</span><input className="input" type="number" min="0" max="168" placeholder={String(hrSettings?.weeklyHours ?? 40)} value={editing.workHoursOverride ?? ""} onChange={(event) => setEditing({ ...editing, workHoursOverride: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
        <label className="field"><span className="field-label">Cadangan khusus (opsional)</span><input className="input" type="number" min="0" max="168" placeholder={String(hrSettings?.reserveHours ?? 0)} value={editing.reserveHoursOverride ?? ""} onChange={(event) => setEditing({ ...editing, reserveHoursOverride: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
        <p className="muted full">Jam reguler {editing.workHoursOverride ?? hrSettings?.weeklyHours ?? 40} · Cadangan {editing.reserveHoursOverride ?? hrSettings?.reserveHours ?? 0} · Dapat direncanakan {Math.max(0, (editing.workHoursOverride ?? hrSettings?.weeklyHours ?? 40) - (editing.reserveHoursOverride ?? hrSettings?.reserveHours ?? 0))} jam per minggu.</p>
      </>}
      {error && <p role="alert">{error}</p>}
      <button className="button primary" type="submit">Simpan profil</button>
    </form></Modal>}
  </div>;
}
