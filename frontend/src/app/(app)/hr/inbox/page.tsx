"use client";

import { useState } from "react";
import { Inbox } from "lucide-react";
import { EmptyState, PageHeading, SectionTitle } from "@/components/app/parts";
import { useDemo } from "@/lib/demo/store";

export default function HrInbox() {
  const { hrRequests = [], dispatch } = useDemo();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const shown = filter === "all" ? hrRequests : hrRequests.filter((item) => !item.read);
  const current = hrRequests.find((item) => item.id === selected);

  return <div className="page-enter"><PageHeading title="Inbox HR" subtitle="Tinjau pengajuan yang dikirim ke HR." />
    <section className="card"><SectionTitle title="Pengajuan masuk" subtitle={`${hrRequests.filter((item) => !item.read).length} belum dibaca`} />
      <div className="toggle" role="group" aria-label="Filter inbox"><button className={filter === "all" ? "selected" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Semua</button><button className={filter === "unread" ? "selected" : ""} aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Belum dibaca</button></div>
      {shown.length ? <div className="table-scroll spaced"><table><thead><tr><th>Pengajuan</th><th>Pengirim</th><th>Waktu</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{shown.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.sender} · {item.senderRole}</td><td>{new Date(item.createdAt).toLocaleString("id-ID")}</td><td>{item.read ? "Dibaca" : "Baru"}</td><td><button className="button" onClick={() => { setSelected(item.id); dispatch({ type: "readHrRequest", id: item.id }); }}>Buka</button></td></tr>)}</tbody></table></div> : <EmptyState icon={Inbox} title="Belum ada pengajuan" text="Pengajuan yang dikirim ke HR akan muncul di sini." />}
    </section>
    {current && <section className="card spaced"><SectionTitle title={current.title} subtitle={`${current.sender} · ${current.senderRole} · ${new Date(current.createdAt).toLocaleString("id-ID")}`} /><p style={{ whiteSpace: "pre-wrap" }}>{current.description}</p><button className="button spaced" onClick={() => setSelected(null)}>Tutup detail</button></section>}
  </div>;
}
