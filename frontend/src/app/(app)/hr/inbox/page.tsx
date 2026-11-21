"use client";

import { useSearchParams } from "next/navigation";
import { updateQuery } from "@/lib/hr/query";
import { useEffect, useState } from "react";
import { CalendarOff, Inbox } from "lucide-react";
import { EmptyState, PageHeading, Person, SectionTitle } from "@/components/app/parts";
import { Badge, Icon } from "@/components/ui";
import { AWAITING_BACKEND, AWAITING_BACKEND_NOTE } from "@/lib/api";
import { useDemo } from "@/lib/demo/store";
import { decideLeave, leaveStatus } from "@/lib/engine/leave";
import { shortDate } from "@/lib/format";

export default function HrInbox() {
  const { hrRequests = [], members, dispatch } = useDemo();
  const leaveQueue = members.flatMap((m) => (m.leaveRequests ?? []).filter((r) => r.hr === "menunggu" && leaveStatus(r) === "menunggu").map((r) => ({ m, r })));
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const selected = useSearchParams().get("request");
  const setSelected = (request: string | null) => updateQuery({ request: request ?? "" });
  const shown = filter === "all" ? hrRequests : hrRequests.filter((item) => !item.read);
  const current = hrRequests.find((item) => item.id === selected);

  useEffect(() => {
    if (current && !current.read) dispatch({ type: "readHrRequest", id: current.id });
  }, [current, dispatch]);

  return <div className="page-enter"><PageHeading title="Inbox HR" subtitle="Tinjau pengajuan yang dikirim ke HR." />
    <section className="card"><SectionTitle title="Pengajuan masuk" subtitle={`${hrRequests.filter((item) => !item.read).length} belum dibaca`} />
      <div className="toggle" role="group" aria-label="Filter inbox"><button className={filter === "all" ? "selected" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Semua</button><button className={filter === "unread" ? "selected" : ""} aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Belum dibaca</button></div>
      {current && <section className="card spaced"><SectionTitle title={current.title} subtitle={current.sender + " · " + current.senderRole} /><p style={{ whiteSpace: "pre-wrap" }}>{current.description}</p>{current.handled ? <p role="status">Sudah ditindaklanjuti</p> : <button className="button primary" onClick={() => dispatch({ type: "handleHrRequest", id: current.id })}>Tandai sudah ditindaklanjuti</button>} <button className="button" onClick={() => setSelected(null)}>Tutup detail</button></section>}
      {shown.length ? <div className="table-scroll spaced"><table><thead><tr><th>Pengajuan</th><th>Pengirim</th><th>Waktu</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{shown.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.sender} · {item.senderRole}</td><td>{new Date(item.createdAt).toLocaleString("id-ID")}</td><td>{item.handled ? "Ditindaklanjuti" : item.read ? "Dibaca" : "Baru"}</td><td><button className="button" onClick={() => { setSelected(item.id); dispatch({ type: "readHrRequest", id: item.id }); }}>Buka</button></td></tr>)}</tbody></table></div> : <EmptyState icon={Inbox} title="Belum ada pengajuan" text="Pengajuan yang dikirim ke HR akan muncul di sini." />}
    </section>
    {leaveQueue.length > 0 && <section className="card spaced"><SectionTitle title="Pengajuan cuti" subtitle="Cuti berlaku setelah manajer dan HR sama-sama setuju." action={<Badge tone="warn">{leaveQueue.length} menunggu</Badge>} />
      {leaveQueue.map(({ m, r }) => <div key={r.id} className="dna-row"><span><Person member={m} />
        <span className="table-sub with-icon"><Icon icon={CalendarOff} size={13} />{r.type} · {shortDate(r.start)}{r.end !== r.start ? ` - ${shortDate(r.end)}` : ""} · Manajer: {r.manager}</span>
        <span className="table-sub">{r.reason}</span></span>
        <span className="page-actions">
          <button type="button" className="button secondary" disabled={AWAITING_BACKEND} onClick={() => dispatch({ type: "upsertMember", member: decideLeave(m, r.id, "hr", false) })}>Tolak</button>
          <button type="button" className="button primary" disabled={AWAITING_BACKEND} onClick={() => dispatch({ type: "upsertMember", member: decideLeave(m, r.id, "hr", true) })}>Setujui</button>
        </span></div>)}
      {AWAITING_BACKEND && <p className="small muted spaced">{AWAITING_BACKEND_NOTE}</p>}
    </section>}
  </div>;
}
