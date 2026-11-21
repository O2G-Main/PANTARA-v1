"use client";

import { DatePicker } from "@/components/ui/date-picker";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleAlert, Save, Sparkles } from "lucide-react";
import { FlowSteps, PageHeading } from "@/components/app/parts";
import { Icon } from "@/components/ui";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { mockDna } from "@/lib/demo/mock-dna";
import { NOW } from "@/lib/demo/seed";
import { useDemo } from "@/lib/demo/store";
import type { Priority, Task } from "@/lib/demo/types";

interface Errors {
  title?: string;
  description?: string;
  dueDate?: string;
  projectId?: string;
  form?: string;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

export function TaskForm() {
  const { projects, tasks, period, today, dispatch } = useDemo();
  const router = useRouter();
  const defaultDue = period?.end && period.end >= today ? period.end : today;
  const [form, setForm] = useState({
    projectId: "",
    title: "",
    description: "",
    dueDate: "",
    dueTime: "17:00",
    priority: "normal" as Priority,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const projectId = form.projectId && projects.some((p) => p.id === form.projectId) ? form.projectId : projects[0]?.id ?? "";
  const dueDate = form.dueDate || defaultDue;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  function validate(draft: boolean): Errors {
    const e: Errors = {};
    if (!form.title.trim()) e.title = "Tulis judul tugas.";
    if (!projectId) e.projectId = "Pilih proyek.";
    if (!draft && form.description.trim().length < 20)
      e.description = "Deskripsi minimal 20 karakter supaya kebutuhan bisa diurai.";
    if (!dueDate) e.dueDate = "Pilih tenggat.";
    else if (dueDate < today) e.dueDate = "Tenggat sudah lewat. Pilih hari ini atau sesudahnya.";
    return e;
  }

  async function submit(draft: boolean) {
    if (busy) return;
    const e = validate(draft);
    setErrors(e);
    if (Object.keys(e).length) return;

    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        const res = await api.tasks.create({
          projectId,
          title: form.title.trim(),
          description: form.description.trim(),
          dueDate,
          dueTime: form.dueTime,
          priority: form.priority,
          draft,
        });
        dispatch({ type: "upsertTask", task: res.task });
        dispatch({ type: "startFlow", id: res.task.id, at: Date.now() });
        router.push(draft ? "/tugas?status=draf" : `/tugas/${res.task.id}/kebutuhan`);
      } catch (err) {
        setBusy(false);
        setErrors({ form: err instanceof ApiError ? err.message : "Gagal menyimpan tugas baru." });
      }
      return;
    }

    const next = Math.max(140, ...tasks.map((t) => Number(t.id.slice(4)) || 0)) + 1;
    const id = `TGS-${String(next).padStart(4, "0")}`;
    const task: Task = {
      id,
      projectId,
      title: form.title.trim(),
      description: form.description.trim(),
      dueDate,
      dueTime: form.dueTime,
      priority: form.priority,
      status: draft ? "draf" : "belum",
      assignments: [],
      remainingHours: 0,
      createdAt: NOW,
      competencyIds: [],
      dna: draft ? undefined : mockDna(form.title, form.description, form.priority),
    };
    dispatch({ type: "createTask", task });
    dispatch({ type: "startFlow", id, at: Date.now() });
    router.push(draft ? "/tugas?status=draf" : `/tugas/${id}/kebutuhan`);
  }

  const field = (key: keyof Errors) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
  });

  return (
    <div className="page-enter">
      <PageHeading title="Buat tugas" subtitle="Tulis tugas seperti biasa. Kebutuhannya diurai di langkah berikutnya dan bisa kamu koreksi." />
      <FlowSteps current={0} />
      <form
        className="card form-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        {errors.form && (
          <p className="login-alert spaced" role="alert">
            <Icon icon={CircleAlert} size={16} />
            {errors.form}
          </p>
        )}
        <div className="form-grid">
          <label className="field full">
            <span className="field-label">Judul tugas</span>
            <input
              className="input"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Integrasi pembayaran QRIS di kasir"
              {...field("title")}
            />
            {errors.title && (
              <span id="title-error" className="field-error">
                {errors.title}
              </span>
            )}
          </label>
          <label className="field full">
            <span className="field-label">Deskripsi</span>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Apa yang dikerjakan, untuk siapa, dan batasannya. Sebut teknologi atau bagian sistem yang terlibat."
              {...field("description")}
            />
            {errors.description ? (
              <span id="description-error" className="field-error">
                {errors.description}
              </span>
            ) : (
              <span className="field-hint">
                {form.description.trim().length} karakter. Semakin jelas, semakin sedikit isian yang perlu dicek.
              </span>
            )}
          </label>
          <label className="field">
            <span className="field-label">Proyek</span>
            <select className="select" value={projectId} onChange={(e) => set("projectId", e.target.value)} {...field("projectId")}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.projectId && (
              <span id="projectId-error" className="field-error">
                {errors.projectId}
              </span>
            )}
          </label>
          <label className="field">
            <span className="field-label">Tenggat</span>
            <DatePicker min={today} value={dueDate} onChange={(v) => set("dueDate", v)} {...field("dueDate")} />
            {errors.dueDate && (
              <span id="dueDate-error" className="field-error">
                {errors.dueDate}
              </span>
            )}
          </label>
          <label className="field">
            <span className="field-label">Jam tenggat (WIB)</span>
            <select className="select" value={form.dueTime} onChange={(e) => set("dueTime", e.target.value)}>
              {(TIME_OPTIONS.includes(form.dueTime) ? TIME_OPTIONS : [...TIME_OPTIONS, form.dueTime].sort()).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="field-hint">Anggota bisa minta tambahan waktu 2 jam sebelum tenggat.</span>
          </label>
          <fieldset className="field full">
            <legend className="field-label">Prioritas</legend>
            <div className="radio-pills">
              {(["rendah", "normal", "tinggi"] as Priority[]).map((p) => (
                <label key={p}>
                  <input type="radio" name="priority" checked={form.priority === p} onChange={() => set("priority", p)} />
                  {p[0].toUpperCase() + p.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="form-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={() => void submit(true)}>
            <Icon icon={Save} />
            Simpan draf
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            <Icon icon={Sparkles} />
            {busy ? "Menyimpan..." : "Analisis kebutuhan"}
          </button>
        </div>
      </form>
    </div>
  );
}
