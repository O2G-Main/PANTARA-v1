"use client";

import { Paged } from "@/components/ui/pager";
import { DatePicker } from "@/components/ui/date-picker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ArrowRight, CircleAlert, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { EmptyState, PageHeading, Person, PriorityBadge, SectionTitle, StatusBadge } from "@/components/app/parts";
import { Icon, Modal } from "@/components/ui";
import { GlassFolder } from "@/components/ui/glass-folder";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { useDemo } from "@/lib/demo/store";
import type { Project } from "@/lib/demo/types";
import { hours, shortDate } from "@/lib/format";

export function Projects() {
  const { projects, tasks, today, dispatch } = useDemo();
  const [adding, setAdding] = useState(false);

  const handleCreate = async (name: string, client: string, dueDate: string) => {
    if (DATA_MODE === "api") {
      const res = await api.projects.create({ name, client, dueDate });
      dispatch({ type: "upsertProject", project: res.project });
      setAdding(false);
      return;
    }
    dispatch({
      type: "addProject",
      project: { id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, client, dueDate },
    });
    setAdding(false);
  };

  return (
    <div className="page-enter">
      <PageHeading
        title="Proyek"
        subtitle="Kelompokkan tugas per proyek atau klien untuk melihat beban dan tenggat bersama."
        actions={
          <button className="button primary" onClick={() => setAdding(true)}>
            <Icon icon={FolderPlus} />
            Buat proyek
          </button>
        }
      />
      <div className="project-folders">
        {projects.map((p, i) => {
          const own = tasks.filter((t) => t.projectId === p.id && t.assignments.every((a) => a.hours > 0));
          const open = own.filter((t) => t.status !== "selesai").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
          return (
            <div key={p.id} className="project-folder">
              <div className="project-folder-art">
                <GlassFolder
                  label={p.name}
                  meta={`${open.length} tugas terbuka · tenggat ${shortDate(p.dueDate)}`}
                  seed={i * 7 + 3}
                  art={i % 2 ? "streak" : "marble"}
                  files={open.map((t) => ({ name: t.title, meta: shortDate(t.dueDate), href: `/tugas/${t.id}` }))}
                  menu={[
                    { label: "Lihat detail proyek", href: `/proyek/${p.id}` },
                    { label: "Buat tugas", href: "/tugas/baru" },
                  ]}
                />
                <Link className="project-folder-cover" href={`/proyek/${p.id}`} aria-hidden="true" tabIndex={-1} />
              </div>
              <div className="project-folder-caption">
                <strong>{p.name}</strong>
                <span>
                  {open.length} tugas terbuka · tenggat {shortDate(p.dueDate)}
                </span>
              </div>
              <div className="project-folder-info">
                <span>{p.client}</span>
                <Link className="text-link" href={`/proyek/${p.id}`}>
                  Detail proyek
                  <Icon icon={ArrowRight} size={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      {adding && <ProjectFormModal title="Buat proyek" submitLabel="Buat proyek" today={today} onClose={() => setAdding(false)} onSave={handleCreate} />}
    </div>
  );
}

function ProjectFormModal({
  title,
  submitLabel,
  today,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  submitLabel: string;
  today: string;
  initial?: Project;
  onClose: () => void;
  onSave: (name: string, client: string, due: string) => Promise<void> | void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [client, setClient] = useState(initial?.client ?? "");
  const [due, setDue] = useState(initial?.dueDate ?? today);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 3) return setError("Tulis nama proyek.");
    if (!initial && due < today) return setError("Tenggat sudah lewat.");
    setBusy(true);
    try {
      await onSave(name.trim(), client.trim() || "Internal", due);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan proyek.");
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form noValidate onSubmit={(e) => void submit(e)}>
        <div className="form-grid">
          <label className="field full">
            <span className="field-label">Nama proyek</span>
            <input
              className="input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Aplikasi reservasi Homestay Ijen"
            />
          </label>
          <label className="field">
            <span className="field-label">Klien</span>
            <input
              className="input"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="CV Kawah Biru Banyuwangi"
            />
          </label>
          <label className="field">
            <span className="field-label">Tenggat</span>
            <DatePicker
              value={due}
              onChange={(v) => {
                setDue(v);
                setError("");
              }}
            />
          </label>
        </div>
        {error && (
          <p className="field-error spaced" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Menyimpan..." : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { projectById, tasks, memberById, today, loading, dispatch } = useDemo();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const project = projectById(id);
  if (loading && !project) {
    return (
      <section className="card">
        <div className="answer-skeleton" aria-busy="true">
          <div />
          <div />
          <div />
        </div>
      </section>
    );
  }
  if (!project) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Proyek tidak ditemukan"
        text="Proyek ini tidak ada."
        action={
          <Link className="button secondary" href="/proyek">
            Kembali ke Proyek
          </Link>
        }
      />
    );
  }

  const own = tasks.filter((t) => t.projectId === id && t.assignments.every((a) => a.hours > 0));

  const handleUpdate = async (name: string, client: string, dueDate: string) => {
    if (DATA_MODE === "api") {
      const res = await api.projects.update(id, { name, client, dueDate });
      dispatch({ type: "upsertProject", project: res.project });
      setEditing(false);
      return;
    }
    dispatch({ type: "upsertProject", project: { id, name, client, dueDate } });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (busy) return;
    setError("");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        await api.projects.delete(id);
        dispatch({ type: "removeProject", id });
        router.push("/proyek");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal mengarsipkan proyek.");
        setBusy(false);
      }
      return;
    }
    dispatch({ type: "removeProject", id });
    router.push("/proyek");
  };

  return (
    <div className="page-enter">
      <PageHeading
        title={project.name}
        subtitle={`${project.client} · tenggat ${shortDate(project.dueDate)}`}
        actions={
          <>
            <button type="button" className="button secondary" disabled={busy} onClick={() => setEditing(true)}>
              <Icon icon={Pencil} size={16} />
              Ubah proyek
            </button>
            <button type="button" className="button secondary" disabled={busy} onClick={() => void handleDelete()}>
              <Icon icon={Trash2} size={16} />
              Arsipkan
            </button>
            <Link className="button primary" href="/tugas/baru">
              Buat tugas
            </Link>
          </>
        }
      />
      {error && (
        <div className="decision-banner warn" role="alert">
          <Icon icon={CircleAlert} />
          <span>
            <strong>Gagal</strong>
            <span>{error}</span>
          </span>
        </div>
      )}
      <section className="card">
        <SectionTitle title="Tugas proyek" subtitle={`${own.length} tugas`} />
        <Paged items={own} unit="tugas">
          {(paged) => (
            <div className="table-scroll stack-table">
              <table>
                <thead>
                  <tr>
                    <th>Tugas</th>
                    <th>Prioritas</th>
                    <th>Status</th>
                    <th>Penanggung jawab</th>
                    <th className="numeric">Estimasi</th>
                    <th>Tenggat</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/tugas/${t.id}`}>
                          <strong>{t.title}</strong>
                        </Link>
                        <span className="table-sub mono">{t.id}</span>
                      </td>
                      <td data-label="Prioritas">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={t.status} />
                      </td>
                      <td data-label="Penanggung jawab">
                        {t.assignments.length ? (
                          t.assignments.map((a) => {
                            const m = memberById(a.memberId);
                            return m ? <Person key={m.id} member={m} /> : null;
                          })
                        ) : (
                          <span className="muted">Belum ada</span>
                        )}
                      </td>
                      <td data-label="Estimasi" className="numeric">
                        {hours(t.dna?.effortHours ?? t.assignments.reduce((s, a) => s + a.hours, 0))}
                      </td>
                      <td data-label="Tenggat">{shortDate(t.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Paged>
      </section>
      {editing && (
        <ProjectFormModal
          title="Ubah proyek"
          submitLabel="Simpan perubahan"
          today={today}
          initial={project}
          onClose={() => setEditing(false)}
          onSave={handleUpdate}
        />
      )}
    </div>
  );
}
