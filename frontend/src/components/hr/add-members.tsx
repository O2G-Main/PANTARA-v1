"use client";

import { Choice, employmentChoices } from "@/components/hr/filter-combobox";
import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { Icon } from "@/components/ui";
import { AsyncSelect } from "@/components/ui/async-select";
import { Modal } from "@/components/ui";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { useDemo } from "@/lib/demo/store";
import type { Member } from "@/lib/demo/types";

type Step = "choose" | "existing" | "confirm" | "new";

export function AddDivisionMembers({ division, onClose }: { division: string; onClose: () => void }) {
  const { members, dispatch } = useDemo();
  const [step, setStep] = useState<Step>("choose");
  const [selected, setSelected] = useState<string[]>([]);
  const [team, setTeam] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", role: "", team: "", employmentType: "karyawan" as "karyawan" | "freelancer", weeklyLimit: 40 });
  const chosen = members.filter((member) => selected.includes(member.id) && member.division?.trim() !== division);
  const transfers = chosen.filter((member) => member.division?.trim());
  const searchMembers = useCallback(async (query: string) => {
    const search = query.trim().toLowerCase();
    return members.filter((member) => member.division?.trim() !== division && `${member.name} ${member.email}`.toLowerCase().includes(search));
  }, [members, division]);


  async function placeMembers() {
    if (busy) return;
    if (!chosen.length) {
      setError("Pilih setidaknya satu anggota.");
      return;
    }
    if (DATA_MODE === "api") {
      setBusy(true);
      setError("");
      try {
        await api.hr.placeMembers({ ids: chosen.map((member) => member.id), division, team: team.trim() || undefined });
        dispatch({ type: "placeMembers", ids: chosen.map((member) => member.id), division, team: team.trim() || undefined });
        onClose();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menempatkan anggota.");
        setBusy(false);
      }
      return;
    }
    dispatch({ type: "placeMembers", ids: chosen.map((member) => member.id), division, team: team.trim() || undefined });
    onClose();
  }

  async function readCv(file: File) {
    setReading(true);
    setError("");
    setStatus("Membaca CV di perangkat ini...");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let text = "";
      if (extension === "pdf") {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
        const document = await loadingTask.promise;
        try {
          const pages: string[] = [];
          for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
            const page = await document.getPage(pageNumber);
            const content = await page.getTextContent();
            pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
          }
          text = pages.join("\n");
        } finally {
          await loadingTask.destroy();
        }
      } else if (extension === "docx") {
        const mammoth = await import("mammoth");
        text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
      } else {
        throw new Error("Pilih file PDF atau DOCX.");
      }
      if (!text.trim()) throw new Error("Teks tidak ditemukan. Jika CV berupa hasil pindai, isi formulir secara manual.");
      const matches = [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((value) => value.toLowerCase()))];
      setProfile((current) => ({ ...current, email: current.email || (matches.length === 1 ? matches[0] : "") }));
      setStatus(matches.length === 1 ? "Email ditemukan. Periksa hasil dan lengkapi profil." : "CV terbaca. Lengkapi profil secara manual dan periksa semua data.");
    } catch (cause) {
      setStatus("");
      setError(cause instanceof Error ? cause.message : "CV tidak dapat dibaca. Isi profil secara manual.");
    } finally {
      setReading(false);
    }
  }

  async function createMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = profile.name.trim();
    const email = profile.email.trim().toLowerCase();
    if (!name || !profile.role.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Isi nama, jabatan, dan email yang valid.");
      return;
    }
    if (members.some((member) => member.email.trim().toLowerCase() === email)) {
      setError("Email sudah digunakan anggota lain.");
      return;
    }
    if (DATA_MODE === "api") {
      setBusy(true);
      setError("");
      try {
        const res = await api.members.create({
          name,
          email,
          role: profile.role.trim(),
          access: "anggota",
          division,
          team: profile.team.trim(),
          employmentType: profile.employmentType,
          weeklyLimit: profile.weeklyLimit,
        });
        dispatch({ type: "upsertMember", member: res.member });
        onClose();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menyimpan anggota.");
        setBusy(false);
      }
      return;
    }
    const member: Member = {
      id: crypto.randomUUID(), name, email, initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
      role: profile.role.trim(), division, team: profile.team.trim(), employmentType: profile.employmentType,
      weeklyLimit: profile.weeklyLimit, availableHours: null, leaveDates: [], competencies: [], prefers: [], avoids: [], access: "anggota",
    };
    dispatch({ type: "upsertMember", member });
    onClose();
  }

  return <Modal title={`Tambah anggota · ${division}`} onClose={onClose}>
    {step === "choose" && <div className="form-grid">
      <button type="button" className="button" onClick={() => setStep("existing")}>Pilih anggota yang sudah ada</button>
      <button type="button" className="button primary" onClick={() => setStep("new")}>Buat anggota baru</button>
    </div>}
    {step === "existing" && <div>
      <AsyncSelect
        label="Cari anggota"
        placeholder="Nama atau email"
        fetcher={searchMembers}
        value={selected}
        onChange={setSelected}
        getOptionValue={(member) => member.id}
        renderOption={(member) => <span className="flex min-w-0 flex-col"><strong className="text-sm">{member.name}</strong><span className="break-words text-xs text-on-surface-muted">{member.division?.trim() || "Belum ada divisi"} · {member.email}</span></span>}
        noResultsMessage="Tidak ada anggota yang cocok."
      />
      <p className="muted">{chosen.length} anggota dipilih</p>
      <label className="field spaced"><span className="field-label">Tim (opsional)</span><input className="input" value={team} onChange={(event) => setTeam(event.target.value)} placeholder="Kosongkan untuk mempertahankan tim saat ini" /></label>
      {error && <p role="alert" className="field-error">{error}</p>}
      <div className="toolbar spaced"><button className="button" onClick={() => { setError(""); setStep("choose"); }}>Kembali</button><button className="button primary" disabled={busy} onClick={() => { if (!chosen.length) setError("Pilih setidaknya satu anggota."); else if (transfers.length) { setError(""); setStep("confirm"); } else void placeMembers(); }}>Tambahkan</button></div>
    </div>}
    {step === "confirm" && <div>
      <p>Anggota berikut akan dipindahkan ke {division}:</p>
      <ul className="spaced">{transfers.map((member) => <li key={member.id}>{member.name} · {member.division}</li>)}</ul>
      {error && <p role="alert" className="field-error">{error}</p>}
      <div className="toolbar spaced"><button className="button" onClick={() => setStep("existing")}>Kembali</button><button className="button primary" disabled={busy} onClick={() => void placeMembers()}>{busy ? "Menyimpan..." : "Konfirmasi perpindahan"}</button></div>
    </div>}
    {step === "new" && <form onSubmit={(e) => void createMember(e)} className="form-grid">
      <div className="field full">
        <span className="field-label">CV (opsional)</span>
        <label className={`hr-cv-upload${dragging ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file && !reading) void readCv(file); }}>
          <span className="hr-cv-icon"><Icon icon={Upload} size={21} /></span>
          <strong>Tarik CV ke sini</strong>
          <span className="muted">PDF atau DOCX · dibaca di perangkat ini</span>
          <span className="hr-cv-button">Pilih file</span>
          <input className="hr-cv-input" type="file" disabled={reading} accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readCv(file); event.target.value = ""; }} />
        </label>
      </div>
      {status && <p className="full" role="status">{status}</p>}
      {([["name", "Nama lengkap"], ["email", "Email"], ["role", "Jabatan"], ["team", "Tim (opsional)"]] as const).map(([key, label]) => <label className="field full" key={key}><span className="field-label">{label}</span><input className="input" value={profile[key]} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} /></label>)}
      <label className="field full"><span className="field-label">Divisi</span><input className="input" value={division} readOnly /></label>
      <Choice label="Jenis hubungan kerja" choices={employmentChoices} value={profile.employmentType} onChange={value => setProfile({ ...profile, employmentType: value as "karyawan" | "freelancer" })} />
      <label className="field"><span className="field-label">Jam kerja per minggu</span><input className="input" type="number" min="0" max="168" required value={profile.weeklyLimit} onChange={(event) => setProfile({ ...profile, weeklyLimit: Number(event.target.value) })} /></label>
      {error && <p className="full field-error" role="alert">{error}</p>}
      <div className="toolbar full"><button className="button" type="button" onClick={() => { setError(""); setStep("choose"); }}>Kembali</button><button className="button primary" type="submit" disabled={reading || busy}>{busy ? "Menyimpan..." : "Simpan anggota"}</button></div>
    </form>}
  </Modal>;
}
