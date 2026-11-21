import { describe, expect, it } from "vitest";
import type { LeaveRequest, Member } from "@/lib/demo/types";
import { decideLeave, leaveError, leaveStatus } from "./leave";

const req = (patch: Partial<LeaveRequest> = {}): LeaveRequest => ({
  id: "c1", start: "2026-10-01", end: "2026-10-05", type: "tahunan", reason: "Acara keluarga di luar kota", requestedAt: "", manager: "menunggu", hr: "menunggu", ...patch,
});
const member = (r: LeaveRequest): Member => ({
  id: "m", name: "M", initials: "M", role: "", email: "", availableHours: 32, leaveDates: ["2026-09-30"], weeklyLimit: 40,
  competencies: [], prefers: [], avoids: [], access: "anggota", leaveRequests: [r],
});

describe("cuti", () => {
  it("berlaku hanya bila manajer dan HR setuju, urutan bebas", () => {
    expect(leaveStatus(req())).toBe("menunggu");
    expect(leaveStatus(req({ manager: "disetujui" }))).toBe("menunggu");
    expect(leaveStatus(req({ hr: "disetujui" }))).toBe("menunggu");
    expect(leaveStatus(req({ manager: "disetujui", hr: "disetujui" }))).toBe("disetujui");
    expect(leaveStatus(req({ manager: "disetujui", hr: "ditolak" }))).toBe("ditolak");
  });

  it("persetujuan kedua memasukkan hari kerja rentang cuti ke tanggal cuti", () => {
    const half = decideLeave(member(req({ hr: "disetujui" })), "c1", "manager", true);
    expect(half.leaveDates).toEqual(["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-05"]);
    expect(half.leaveRequests?.[0].manager).toBe("disetujui");
  });

  it("persetujuan satu pihak atau penolakan tidak mengubah tanggal cuti", () => {
    const m = member(req());
    expect(decideLeave(m, "c1", "manager", true).leaveDates).toEqual(["2026-09-30"]);
    const rejected = decideLeave(m, "c1", "manager", false);
    expect(leaveStatus(rejected.leaveRequests![0])).toBe("ditolak");
    expect(decideLeave(rejected, "c1", "hr", true)).toBe(rejected);
  });

  it("validasi form", () => {
    const today = "2026-09-29";
    expect(leaveError("", "2026-10-01", "Acara keluarga", today)).toMatch("Pilih");
    expect(leaveError("2026-09-28", "2026-10-01", "Acara keluarga", today)).toMatch("sebelum hari ini");
    expect(leaveError("2026-10-02", "2026-10-01", "Acara keluarga", today)).toMatch("selesai");
    expect(leaveError("2026-10-03", "2026-10-04", "Acara keluarga", today)).toMatch("hari kerja");
    expect(leaveError("2026-10-01", "2026-10-01", "Sakit", today)).toMatch("alasan");
    expect(leaveError("2026-10-01", "2026-10-02", "Acara keluarga", today)).toBeNull();
  });
});
