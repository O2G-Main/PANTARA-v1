"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, ChevronDown, Pencil, Plus, Users } from "lucide-react";
import { PageHeading, Person } from "@/components/app/parts";
import { AddDivisionMembers } from "@/components/hr/add-members";
import { AvatarGroup } from "@/components/ui/avatar";
import { Icon, Modal } from "@/components/ui";
import { DATA_MODE } from "@/lib/api";
import { useDemo } from "@/lib/demo/store";

export default function HrTeams() {
  const { members, divisions: savedDivisions, dispatch } = useDemo();
  const [memberDivision, setMemberDivision] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"add" | "edit" | null>(null);
  const [previous, setPrevious] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const groups = new Map<string, typeof members>();

  for (const division of savedDivisions ?? []) groups.set(division, []);
  for (const member of members) {
    const division = member.division?.trim() || "";
    groups.set(division, [...(groups.get(division) ?? []), member]);
  }

  function openDialog(division?: string) {
    setPrevious(division ?? "");
    setName(division ?? "");
    setError("");
    setDialog(division ? "edit" : "add");
  }

  function saveDivision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Isi nama divisi.");
      return;
    }
    if ([...groups.keys()].some((item) => item !== previous && item.toLocaleLowerCase("id-ID") === trimmed.toLocaleLowerCase("id-ID"))) {
      setError("Nama divisi sudah digunakan.");
      return;
    }
    dispatch({ type: "saveDivision", name: trimmed, previous: dialog === "edit" ? previous : undefined });
    setDialog(null);
  }

  return (
    <div className="page-enter">
      <PageHeading title="Tim & divisi" subtitle="Lihat anggota dan susunan tim di setiap divisi." actions={<>
        <Link className="button" href="/hr/anggota">Kelola anggota</Link>
        {DATA_MODE === "mock" && <button className="button primary" type="button" onClick={() => openDialog()}><Icon icon={Plus} />Tambah divisi</button>}
      </>} />
      {groups.size === 0 ? (
        <section className="card"><p>Belum ada divisi. Tambahkan divisi untuk menyusun anggota.</p></section>
      ) : (
        <div className="hr-divisions">
          {[...groups].map(([division, people]) => {
            const teams = new Map<string, typeof members>();
            for (const person of people) {
              const team = person.team?.trim() || "Tim belum diisi";
              teams.set(team, [...(teams.get(team) ?? []), person]);
            }
            return (
              <details className="card hr-building" key={division}>
                <summary className="hr-building-summary">
                  <span className="hr-building-icon"><Icon icon={Building2} size={26} /></span>
                  <span className="hr-building-heading"><strong>{division || "Divisi belum diisi"}</strong><span>{teams.size} tim · {people.length} anggota</span></span>
                  <AvatarGroup size={36} limit={4} members={people.map((person) => ({ username: person.name, src: person.photo, initials: person.initials }))} />
                  <Icon icon={ChevronDown} size={18} className="hr-building-chevron" />
                </summary>
                <div className="hr-building-content">
                  {division && DATA_MODE === "mock" && <div className="hr-team toolbar"><button className="button primary" type="button" onClick={() => setMemberDivision(division)}><Icon icon={Plus} size={16} />Tambah anggota</button><button className="button" type="button" onClick={() => openDialog(division)}><Icon icon={Pencil} size={16} />Edit divisi</button></div>}
                  {!people.length && <p className="muted hr-team">Belum ada anggota. Tambahkan divisi pada profil anggota untuk menempatkannya di sini.</p>}
                  {[...teams].map(([team, teamMembers]) => (
                    <section className="hr-team" key={team}>
                      <div className="hr-team-heading"><span><Icon icon={Users} size={16} /> <strong>{team}</strong></span><span className="muted">{teamMembers.length} anggota</span></div>
                      {teamMembers.map((person) => <div className="hr-team-member" key={person.id}><Person member={person} /><span className="muted">{person.availableHours === null ? "Ketersediaan belum diisi" : `${person.availableHours} jam tersedia`}</span></div>)}
                    </section>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
      {memberDivision && <AddDivisionMembers division={memberDivision} onClose={() => setMemberDivision(null)} />}
      {dialog && <Modal title={dialog === "add" ? "Tambah divisi" : "Edit divisi"} onClose={() => setDialog(null)}>
        <form onSubmit={saveDivision}>
          <label className="field"><span className="field-label">Nama divisi</span><input className="input" autoFocus maxLength={100} value={name} onChange={(event) => { setName(event.target.value); setError(""); }} aria-invalid={!!error} aria-describedby={error ? "division-error" : undefined} /></label>
          {dialog === "edit" && <p className="muted spaced">Nama divisi pada profil anggota akan ikut diperbarui.</p>}
          {error && <p id="division-error" role="alert" className="field-error spaced">{error}</p>}
          <div className="toolbar spaced"><button className="button" type="button" onClick={() => setDialog(null)}>Batal</button><button className="button primary" type="submit">Simpan divisi</button></div>
        </form>
      </Modal>}
    </div>
  );
}
