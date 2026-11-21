import { mockDna } from "./mock-dna";
import type { Member, Priority, Project, Task } from "./types";

// Impor tugas massal dari CSV (CORPORATE-FIRST). Baris dengan kolom dikelola_di adalah pekerjaan di luar PANTARA:
// langsung berjalan atas nama penanggung jawabnya supaya bebannya ikut terhitung.

export const TASK_CSV_HEADER = "judul,proyek,tenggat,jam_tenggat,prioritas,dikelola_di,penanggung_jawab,jam,deskripsi";

export interface ImportRow {
  line: number;
  task?: Task;
  error?: string;
}

const PRIORITIES: Priority[] = ["rendah", "normal", "tinggi"];

/** Urai CSV tugas. Deskripsi kolom terakhir dan boleh berisi koma. Duplikat = judul + proyek sama dengan tugas yang ada atau baris sebelumnya. */
export function parseTaskCsv(
  text: string,
  ctx: { projects: Project[]; members: Member[]; tasks: Task[]; today: string; now: string; nextId: number },
): ImportRow[] {
  const seen = new Set(ctx.tasks.map(t => `${t.projectId}|${t.title.toLowerCase()}`));
  let next = ctx.nextId;
  return text.trim().split(/\r?\n/).slice(1).filter(l => l.trim()).map((l, i): ImportRow => {
    const line = i + 2;
    const cells = l.split(",");
    const [title = "", projectId = "", dueDate = "", dueTime = "", priority = "", source = "", owner = "", hrs = ""] = cells.slice(0, 8).map(s => s.trim());
    const description = cells.slice(8).join(",").trim();
    if (!title) return { line, error: "Judul kosong" };
    if (!ctx.projects.some(p => p.id === projectId)) return { line, error: `Proyek "${projectId}" tidak ada` };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) return { line, error: `Tenggat "${dueDate}" bukan tanggal YYYY-MM-DD` };
    if (dueDate < ctx.today) return { line, error: "Tenggat sudah lewat" };
    if (dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) return { line, error: `Jam tenggat "${dueTime}" bukan HH:MM` };
    const prio = (priority || "normal") as Priority;
    if (!PRIORITIES.includes(prio)) return { line, error: `Prioritas "${priority}" bukan rendah/normal/tinggi` };
    const key = `${projectId}|${title.toLowerCase()}`;
    if (seen.has(key)) return { line, error: "Duplikat: judul yang sama sudah ada di proyek ini" };

    const base = { projectId, title, description, dueDate, dueTime: dueTime || undefined, priority: prio, createdAt: ctx.now, competencyIds: [] };
    let task: Task;
    if (source) {
      const member = ctx.members.find(m => m.email === owner.toLowerCase());
      if (!member) return { line, error: `Penanggung jawab "${owner}" tidak terdaftar` };
      const h = Number(hrs.replace(",", "."));
      if (!Number.isFinite(h) || h <= 0) return { line, error: "Pekerjaan eksternal perlu jam lebih dari 0" };
      task = { ...base, id: "", status: "berjalan", assignments: [{ memberId: member.id, hours: h }], remainingHours: h, externalSource: source };
    } else {
      if (description.length < 20) return { line, error: "Deskripsi minimal 20 karakter supaya kebutuhan bisa diurai" };
      task = { ...base, id: "", status: "belum", assignments: [], remainingHours: 0, dna: mockDna(title, description, prio) };
    }
    seen.add(key);
    task.id = `TGS-${String(next++).padStart(4, "0")}`;
    return { line, task };
  });
}
