"use client";

import { useState } from "react";
import { PageHeading, SectionTitle } from "@/components/app/parts";
import { api, ApiError, DATA_MODE } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useDemo } from "@/lib/demo/store";

export default function SubmitHrRequest() {
  const account = useSession();
  const { dispatch } = useDemo();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!account || !title.trim() || !description.trim()) {
      setMessage("Isi judul dan rincian pengajuan.");
      return;
    }
    if (DATA_MODE === "api") {
      setBusy(true);
      setMessage("");
      try {
        const res = await api.hr.createRequest({ title: title.trim(), description: description.trim() });
        dispatch({ type: "sendHrRequest", request: res.request });
        setTitle("");
        setDescription("");
        setMessage("Pengajuan berhasil dikirim ke inbox HR.");
      } catch (err) {
        setMessage(err instanceof ApiError ? err.message : "Gagal mengirim pengajuan ke HR.");
      } finally {
        setBusy(false);
      }
      return;
    }
    dispatch({ type: "sendHrRequest", request: { id: crypto.randomUUID(), sender: account.name, senderRole: account.title, title: title.trim(), description: description.trim(), createdAt: new Date().toISOString(), read: false } });
    setTitle("");
    setDescription("");
    setMessage("Pengajuan berhasil dikirim ke inbox HR.");
  }

  return <div className="page-enter"><PageHeading title="Pengajuan ke HR" subtitle="Kirim kebutuhan atau pertanyaan kepada HR." />
    <section className="card"><SectionTitle title="Buat pengajuan" />
      <form className="form-grid" onSubmit={(e) => void submit(e)}>
        <label className="field full"><span className="field-label">Judul</span><input className="input" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="field full"><span className="field-label">Rincian</span><textarea className="input" required rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        {message && <p className="full" role="status">{message}</p>}
        <button className="button primary" type="submit" disabled={busy}>{busy ? "Mengirim..." : "Kirim pengajuan"}</button>
      </form>
    </section>
  </div>;
}
