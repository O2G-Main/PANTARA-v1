import { describe, expect, it } from "vitest";
import { parseTaskCsv, TASK_CSV_HEADER } from "./import-tasks";
import { MEMBERS, PROJECTS, TASKS } from "./seed";

const ctx = { projects: PROJECTS, members: MEMBERS, tasks: TASKS, today: "2026-09-29", now: "2026-09-29T09:15:00+07:00", nextId: 500 };

describe("parseTaskCsv", () => {
  it("membuat tugas biasa dengan analisis kebutuhan dan pekerjaan eksternal yang langsung berjalan", () => {
    const rows = parseTaskCsv(`${TASK_CSV_HEADER}
Halaman riwayat angsuran,koperasi,2026-10-09,16:00,normal,,,,Tampilkan riwayat angsuran, filter bulan, dan ekspor PDF.
Pendampingan UAT,klinik,2026-10-02,,,Jira klinik,GITA@pantara.id,6,Sesi UAT bersama staf klinik.`, ctx);
    expect(rows.map(r => r.error)).toEqual([undefined, undefined]);
    const [plain, ext] = rows.map(r => r.task!);
    expect([plain.id, plain.status, plain.dueTime, plain.description]).toEqual(["TGS-0500", "belum", "16:00", "Tampilkan riwayat angsuran, filter bulan, dan ekspor PDF."]);
    expect(plain.dna).toBeDefined();
    expect([ext.id, ext.status, ext.priority, ext.externalSource, ext.remainingHours, ext.assignments]).toEqual(["TGS-0501", "berjalan", "normal", "Jira klinik", 6, [{ memberId: "gita", hours: 6 }]]);
  });

  it("menolak baris bermasalah dan duplikat tanpa memakan nomor tugas", () => {
    const rows = parseTaskCsv(`${TASK_CSV_HEADER}
Modul pembayaran Midtrans,batik,2026-10-06,,tinggi,,,,Duplikat tugas yang sudah ada di seed.
Tugas A,tidak-ada,2026-10-06,,,,,,Deskripsi yang cukup panjang untuk diurai.
Tugas B,smk,2026-09-01,,,,,,Deskripsi yang cukup panjang untuk diurai.
Tugas C,smk,2026-10-06,25:00,,,,,Deskripsi yang cukup panjang untuk diurai.
Tugas D,smk,2026-10-06,,darurat,,,,Deskripsi yang cukup panjang untuk diurai.
Tugas E,smk,2026-10-06,,,,,,Pendek.
Tugas F,smk,2026-10-06,,,Trello,orang@luar.id,4,Eksternal.
Tugas G,smk,2026-10-06,,,Trello,gita@pantara.id,0,Eksternal.
Tugas H,smk,2026-10-06,,,,,,Deskripsi yang cukup panjang untuk diurai.
Tugas H,smk,2026-10-07,,,,,,Deskripsi yang cukup panjang untuk diurai.`, ctx);
    expect(rows.map(r => r.error?.split(" ")[0] ?? r.task?.id)).toEqual(["Duplikat:", "Proyek", "Tenggat", "Jam", "Prioritas", "Deskripsi", "Penanggung", "Pekerjaan", "TGS-0500", "Duplikat:"]);
  });
});
