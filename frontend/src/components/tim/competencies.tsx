"use client";

import { Paged } from "@/components/ui/pager";
import { useState } from "react";
import { CircleAlert, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeading } from "@/components/app/parts";
import { Badge, Icon, Modal } from "@/components/ui";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { useDemo } from "@/lib/demo/store";
import type { Competency } from "@/lib/demo/types";

const DEFAULT_CATEGORIES = ["Backend", "Data", "Frontend", "Mobile", "Desain", "Kualitas", "Infrastruktur", "Dokumentasi"];

/** P30: katalog kompetensi tim. */
export function Competencies() {
  const { competencies, members, tasks, dispatch } = useDemo();
  const [editing, setEditing] = useState<Competency | "new" | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Backend");
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState("");
  const [busy, setBusy] = useState(false);

  const categories = [...new Set([...DEFAULT_CATEGORIES, ...competencies.map((c) => c.category)])];

  const openNew = () => {
    setName("");
    setCategory(categories[0] ?? "Backend");
    setError("");
    setEditing("new");
  };

  const openEdit = (c: Competency) => {
    setName(c.name);
    setCategory(c.category);
    setError("");
    setEditing(c);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !editing) return;
    if (name.trim().length < 2) return setError("Tulis nama kompetensi.");
    const trimmedName = name.trim();

    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        if (editing === "new") {
          const res = await api.competencies.create({ name: trimmedName, category });
          dispatch({ type: "upsertCompetency", competency: res.competency });
        } else {
          const res = await api.competencies.update(editing.id, { name: trimmedName, category });
          dispatch({ type: "upsertCompetency", competency: res.competency });
        }
        setEditing(null);
        setName("");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menyimpan kompetensi.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (editing === "new") {
      const id = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (competencies.some((c) => c.id === id)) return setError("Kompetensi ini sudah ada di katalog.");
      dispatch({ type: "addCompetency", competency: { id, name: trimmedName, category } });
    } else {
      dispatch({ type: "upsertCompetency", competency: { ...editing, name: trimmedName, category } });
    }
    setEditing(null);
    setName("");
  };

  const handleDelete = async (id: string) => {
    if (busy) return;
    setRowError("");
    if (DATA_MODE === "api") {
      setBusy(true);
      try {
        await api.competencies.delete(id);
        dispatch({ type: "removeCompetency", id });
      } catch (err) {
        setRowError(err instanceof ApiError ? err.message : "Gagal menghapus kompetensi.");
      } finally {
        setBusy(false);
      }
      return;
    }
    dispatch({ type: "removeCompetency", id });
  };

  return (
    <div className="page-enter">
      <PageHeading
        title="Katalog kompetensi"
        subtitle="Daftar kompetensi ruang kerja yang dipakai Analisis kebutuhan dan Profil kerja. AI hanya memilih dari katalog ini."
        actions={
          <button className="button primary" onClick={openNew}>
            <Icon icon={Plus} />
            Tambah kompetensi
          </button>
        }
      />
      {rowError && (
        <div className="decision-banner warn" role="alert">
          <Icon icon={CircleAlert} />
          <span>
            <strong>Gagal</strong>
            <span>{rowError}</span>
          </span>
        </div>
      )}
      <section className="card">
        <Paged items={competencies} unit="kompetensi">
          {(paged) => (
            <div className="table-scroll stack-table">
              <table>
                <thead>
                  <tr>
                    <th>Kompetensi</th>
                    <th>Kategori</th>
                    <th className="numeric">Karyawan</th>
                    <th className="numeric">Dipakai tugas aktif</th>
                    <th className="numeric">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => {
                    const usedBy = members.filter((m) => m.competencies.some((x) => x.id === c.id)).length;
                    const inTasks = tasks.filter((t) => t.status !== "selesai" && t.dna?.requirements.some((r) => r.competencyId === c.id)).length;
                    return (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                          <span className="table-sub mono">{c.id}</span>
                        </td>
                        <td data-label="Kategori">{c.category}</td>
                        <td data-label="Karyawan" className="numeric">
                          {usedBy}
                        </td>
                        <td data-label="Tugas aktif" className="numeric">
                          {inTasks ? <Badge tone="ok">{inTasks} tugas</Badge> : <span className="muted">-</span>}
                        </td>
                        <td className="numeric">
                          <div className="page-actions" style={{ justifyContent: "flex-end" }}>
                            <button type="button" className="row-link" aria-label={`Ubah ${c.name}`} onClick={() => openEdit(c)}>
                              <Icon icon={Pencil} size={14} />
                              Ubah
                            </button>
                            <button type="button" className="row-link" disabled={busy} aria-label={`Hapus ${c.name}`} onClick={() => void handleDelete(c.id)}>
                              <Icon icon={Trash2} size={14} />
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Paged>
      </section>
      {editing && (
        <Modal title={editing === "new" ? "Tambah kompetensi" : `Ubah ${editing.name}`} onClose={() => setEditing(null)}>
          <form noValidate onSubmit={(e) => void handleSave(e)}>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">Nama</span>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  placeholder="Flutter"
                />
              </label>
              <label className="field">
                <span className="field-label">Kategori</span>
                <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && (
              <p className="field-error spaced" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setEditing(null)}>
                Batal
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Menyimpan..." : editing === "new" ? "Tambah" : "Simpan"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
