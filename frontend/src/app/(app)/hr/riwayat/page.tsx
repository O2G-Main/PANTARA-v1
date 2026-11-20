"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Icon } from "@/components/ui";
import { PageHeading, SectionTitle } from "@/components/app/parts";
import { useDemo } from "@/lib/demo/store";
import { shortDate } from "@/lib/format";

export default function HrHistory() {
  const { members, tasks } = useDemo();
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const dropdown = useRef<HTMLDetailsElement>(null);
  const matches = members.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(query.trim().toLowerCase()));
  const shown = selected ? members.filter((member) => member.id === selected) : members;
  return <div className="page-enter"><PageHeading title="Riwayat & performa" subtitle="Tinjau tugas yang tercatat untuk setiap anggota." />
    <section className="card"><div className="field"><span className="field-label" id="history-member-label">Anggota</span>
      <details ref={dropdown} className="hr-select" onKeyDown={(event) => { if (event.key === "Escape") { dropdown.current?.removeAttribute("open"); dropdown.current?.querySelector("summary")?.focus(); } }}>
        <summary className="hr-select-trigger" aria-labelledby="history-member-label history-member-value"><span id="history-member-value">{members.find((member) => member.id === selected)?.name ?? "Semua anggota"}</span><Icon icon={ChevronDown} size={18} /></summary>
        <div className="hr-select-panel">
          <label className="search-field"><Icon icon={Search} size={16} /><span className="sr-only">Cari anggota</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau email" /></label>
          <div className="hr-history-options">
            <button type="button" className="hr-history-option" onClick={() => { setSelected(""); setQuery(""); dropdown.current?.removeAttribute("open"); }}><span>Semua anggota</span>{!selected && <Icon icon={Check} size={16} />}</button>
            {matches.map((member) => <button key={member.id} type="button" className="hr-history-option" onClick={() => { setSelected(member.id); setQuery(""); dropdown.current?.removeAttribute("open"); }}><span><strong>{member.name}</strong><small>{member.email}</small></span>{selected === member.id && <Icon icon={Check} size={16} />}</button>)}
            {!matches.length && <p className="muted">Tidak ada anggota yang cocok.</p>}
          </div>
        </div>
      </details></div>
      <p className="muted spaced">Penilaian performa akan tersedia setelah metrik disepakati.</p>
      {shown.map((member) => {
        const history = tasks.filter((task) => task.assignments.some((assignment) => assignment.memberId === member.id));
        return <div className="spaced" key={member.id}><SectionTitle title={member.name} subtitle={`${history.length} tugas tercatat`} />
          {history.length ? <div className="table-scroll"><table><thead><tr><th>Tugas</th><th>Status</th><th>Tenggat</th></tr></thead><tbody>{history.map((task) => <tr key={task.id}><td>{task.title}</td><td>{task.status}</td><td>{shortDate(task.dueDate)}</td></tr>)}</tbody></table></div> : <p>Belum ada riwayat tugas.</p>}
        </div>;
      })}
      {!shown.length && <p>Belum ada anggota.</p>}
    </section>
  </div>;
}
