"use client";

import { Paged } from "@/components/ui/pager";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Download, FileUp, Layers, Plus, Search, SearchX, ShieldAlert } from "lucide-react";
import { EmptyState, PageHeading, Person, PriorityBadge, StatusBadge } from "@/components/app/parts";
import { Badge, Icon, Modal } from "@/components/ui";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { parseTaskCsv, TASK_CSV_HEADER, type ImportRow } from "@/lib/demo/import-tasks";
import { useDemo } from "@/lib/demo/store";
import type { Priority, TaskStatus } from "@/lib/demo/types";
import { date, hours, shortDate } from "@/lib/format";

const FILTERS: { value: TaskStatus | "semua"; label: string }[] = [
  { value: "semua", label: "Semua status" },
  { value: "belum", label: "Belum ditugaskan" },
  { value: "menunggu", label: "Menunggu jawaban" },
  { value: "berjalan", label: "Berjalan" },
  { value: "selesai", label: "Selesai" },
  { value: "draf", label: "Draf" },
];

export function TaskList() {
  const { tasks, names, memberById, projectById, period, now } = useDemo();
  const params = useSearchParams();
  const router = useRouter();
  const status = (params.get("status") ?? "semua") as TaskStatus | "semua";
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<Priority | "semua">("semua");
  const [importing, setImporting] = useState(false);
  const current = tasks.filter(t => t.status !== "selesai" || t.assignments.some(a => a.hours > 0));
  const shown = current.filter(t =>
    (status === "semua" || t.status === status) &&
    (priority === "semua" || t.priority === priority) &&
    `${t.title} ${t.description} ${t.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const count = (s: TaskStatus | "semua") => s === "semua" ? current.length : current.filter(t => t.status === s).length;
  return <div className="page-enter">
    <PageHeading title="Tugas" subtitle="Kelola daftar tugas, alokasi kerja karyawan, dan status penugasan adaptif." actions={<>
      <button type="button" className="button secondary" onClick={() => setImporting(true)}><Icon icon={FileUp} />Impor tugas</button>
      <Link className="button secondary" href="/tugas/massal"><Icon icon={Layers} />Penugasan massal</Link>
      <Link className="button primary" href="/tugas/baru"><Icon icon={Plus} />Buat tugas</Link>
    </>} />
    <section className="card">
      <div className="toolbar">
        <label className="search-field"><Icon icon={Search} size={16} /><span className="sr-only">Cari tugas</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama tugas atau deskripsi" /></label>
        <label className="filter-select"><span className="sr-only">Prioritas</span>
          <select value={priority} onChange={e => setPriority(e.target.value as Priority | "semua")}>
            <option value="semua">Semua prioritas</option><option value="tinggi">Tinggi</option><option value="normal">Normal</option><option value="rendah">Rendah</option>
          </select>
        </label>
      </div>
      <div className="toggle" role="group" aria-label="Filter status">
        {FILTERS.filter(f => f.value === "semua" || count(f.value)).map(f => <button key={f.value} className={status === f.value ? "selected" : ""} aria-pressed={status === f.value} onClick={() => router.replace(f.value === "semua" ? "/tugas" : `/tugas?status=${f.value}`, { scroll: false })}>{f.label} ({count(f.value)})</button>)}
      </div>
      {shown.length ? <Paged items={shown} unit="tugas">{(paged) => <><div className="table-scroll stack-table spaced"><table>
        <thead><tr><th>Tugas & kebutuhan</th><th>Prioritas</th><th>Status</th><th>Penanggung jawab</th><th className="numeric">Sisa estimasi</th><th>Tenggat</th><th className="numeric">Aksi</th></tr></thead>
        <tbody>{paged.map(t => {
          const assignees = t.assignments.map(a => memberById(a.memberId)).filter(m => m !== undefined);
          const need = t.dna ? t.dna.requirements.map(r => names[r.competencyId]).join(", ") : t.competencyIds.map(c => names[c]).join(", ") || "Belum dianalisis";
          return <tr key={t.id}>
            <td><Link href={`/tugas/${t.id}`}><strong>{t.title}</strong></Link><span className="table-sub"><span className="mono">{t.id}</span> · {projectById(t.projectId)?.name}{t.externalSource ? ` · dikelola di ${t.externalSource}` : ""}</span><span className="table-sub">Kebutuhan: {need}</span></td>
            <td data-label="Prioritas"><PriorityBadge priority={t.priority} /></td>
            <td data-label="Status"><StatusBadge status={t.status} /></td>
            <td data-label="Penanggung jawab">{assignees.length ? assignees.map(m => <Person key={m.id} member={m} />) : <span className="muted">Belum ada penanggung jawab</span>}</td>
            <td data-label="Sisa estimasi" className="numeric">{t.status === "selesai" ? <span className="muted">0 jam ({hours(t.assignments.reduce((s, a) => s + a.hours, 0))})</span> : t.status === "berjalan" ? `${hours(t.remainingHours)} tersisa` : hours(t.dna?.effortHours ?? t.remainingHours)}</td>
            <td data-label="Tenggat" title={date(t.dueDate)}>{shortDate(t.dueDate)}</td>
            <td className="numeric">{t.status === "belum" ? <Link className="row-link accent" href={t.dna?.confirmed ? `/tugas/${t.id}/kandidat` : `/tugas/${t.id}/kebutuhan`}>Cari kandidat</Link> : t.status === "draf" ? <Link className="row-link" href={`/tugas/${t.id}/kebutuhan`}>Lanjutkan</Link> : <Link className="row-link" href={`/tugas/${t.id}`}>Buka tugas</Link>}</td>
          </tr>;
        })}</tbody>
      </table></div></>}</Paged> : <EmptyState icon={SearchX} title="Tidak ada tugas yang cocok" text="Ubah kata kunci atau filter status dan prioritas." action={<button className="button secondary" onClick={() => { setQuery(""); setPriority("semua"); router.replace("/tugas"); }}>Hapus filter</button>} />}
      <div className="table-footer"><span>Menampilkan {shown.length} dari {current.length} tugas {period ? `(${period.label})` : "periode ini"}</span><span>Diperbarui {now ? new Date(now).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "09.15"} WIB</span></div>
    </section>
    {importing && <ImportTasks onClose={() => setImporting(false)} />}
  </div>;
}

/** Contoh CSV bertanggal relatif ke hari ini supaya tidak pernah "tenggat sudah lewat". */
const sample = (today: string) => {
  const at = (days: number) => new Date(Date.parse(today) + days * 86_400_000).toISOString().slice(0, 10);
  return `${TASK_CSV_HEADER}
Halaman riwayat angsuran,koperasi,${at(10)},16:00,normal,,,,Tampilkan riwayat angsuran per anggota dengan filter bulan dan ekspor PDF.
Pendampingan UAT klinik,klinik,${at(3)},15:00,normal,Jira klinik,gita@pantara.id,6,Sesi UAT bersama staf klinik yang dikelola di Jira klien.`;
};

function ImportTasks({ onClose }: { onClose: () => void }) {
  const { projects, members, tasks, today, now, dispatch } = useDemo();
  const [mode, setMode] = useState<"berkas" | "manual">("berkas");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const valid = rows?.filter(r => r.task) ?? [];

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return setError("Berkas harus berformat .csv.");
    setCsv(await f.text());
    setFileName(f.name);
    setError("");
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([sample(today)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "template-impor-tugas.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };
  const check = async () => {
    if (busy) return;
    if (!csv.trim()) return setError(mode === "berkas" ? "Pilih atau seret berkas CSV dulu." : "Isi data CSV dulu.");
    if (!csv.trim().toLowerCase().startsWith("judul,")) return setError(`Baris pertama harus header: ${TASK_CSV_HEADER}`);
    if (DATA_MODE === "api") {
      setBusy(true);
      setError("");
      try {
        const res = await api.tasks.importCsv({ csv, dryRun: true });
        setRows(res.rows);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal memeriksa data CSV.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setRows(parseTaskCsv(csv, {
      projects, members, tasks, today, now: now || new Date().toISOString(),
      nextId: Math.max(140, ...tasks.map(t => Number(t.id.slice(4)) || 0)) + 1,
    }));
  };

  const commitImport = async () => {
    if (busy || !valid.length) return;
    if (DATA_MODE === "api") {
      setBusy(true);
      setError("");
      try {
        const res = await api.tasks.importCsv({ csv, dryRun: false });
        res.rows.forEach((r) => r.task && dispatch({ type: "upsertTask", task: r.task }));
        onClose();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal mengimpor tugas.");
        setBusy(false);
      }
      return;
    }
    valid.forEach((r) => r.task && dispatch({ type: "createTask", task: r.task }));
    onClose();
  };

  return <Modal title="Impor tugas" onClose={onClose}>
    {rows === null ? <>
      <div className="import-template">
        <span>
          <strong>Template CSV</strong>
          <span className="small muted">Berisi header dan contoh baris, termasuk pekerjaan di luar PANTARA (isi dikelola_di, email penanggung jawab, dan jam).</span>
        </span>
        <button type="button" className="button secondary" onClick={downloadTemplate}><Icon icon={Download} size={16} />Unduh template</button>
      </div>
      <div className="toggle spaced" role="group" aria-label="Cara impor">
        {([["berkas", "Unggah berkas"], ["manual", "Isi manual"]] as const).map(([v, l]) =>
          <button key={v} type="button" className={mode === v ? "selected" : ""} aria-pressed={mode === v} onClick={() => { setMode(v); setError(""); }}>{l}</button>)}
      </div>
      {mode === "berkas" ? (
        <label
          className={`dropzone spaced${dragging ? " active" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); void readFile(e.dataTransfer.files[0]); }}
        >
          <Icon icon={FileUp} size={22} />
          <strong>{fileName || "Seret berkas CSV ke sini"}</strong>
          <span className="small muted">{fileName ? `${csv.trim().split(/\r?\n/).length - 1} baris data. Klik untuk mengganti berkas.` : "atau klik untuk memilih berkas .csv"}</span>
          <input className="sr-only" type="file" accept=".csv,text/csv" onChange={e => void readFile(e.target.files?.[0])} />
        </label>
      ) : (
        <label className="field spaced">
          <span className="field-label">Data CSV (baris pertama header)</span>
          <textarea className="mono" rows={7} value={csv} placeholder={TASK_CSV_HEADER} onChange={e => { setCsv(e.target.value); setFileName(""); setError(""); }} />
        </label>
      )}
      {error && <p className="field-error spaced" role="alert">{error}</p>}
    </> : <div>
      {rows.map(r => <div key={r.line} className="dna-row">
        <span><span className="mono">Baris {r.line}</span> · {r.task ? <>{r.task.title}{r.task.externalSource ? ` (eksternal, ${r.task.remainingHours} jam)` : ""}</> : <span className="warn-text with-icon"><Icon icon={ShieldAlert} size={13} />{r.error}</span>}</span>
        {r.task && <Badge tone="ok">Siap</Badge>}
      </div>)}
    </div>}
    <div className="dialog-actions">
      {rows === null
        ? <><button type="button" className="button secondary" onClick={onClose}>Batal</button><button type="button" className="button primary" disabled={busy} onClick={() => void check()}><Icon icon={FileUp} size={16} />{busy ? "Memeriksa..." : "Periksa data"}</button></>
        : <><button type="button" className="button secondary" disabled={busy} onClick={() => { setRows(null); setError(""); }}>Perbaiki data</button>
          <button type="button" className="button primary" disabled={busy || !valid.length} onClick={() => void commitImport()}>{busy ? "Mengimpor..." : `Impor ${valid.length} tugas`}</button></>}
    </div>
  </Modal>;
}
