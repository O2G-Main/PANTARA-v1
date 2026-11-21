import type { Approval, LeaveRequest, Member } from "@/lib/demo/types";
import { workdays } from "./capacity";

/** Status gabungan: ditolak bila salah satu menolak, disetujui bila manajer dan HR sama-sama setuju. */
export function leaveStatus(req: LeaveRequest): Approval {
  if (req.manager === "ditolak" || req.hr === "ditolak") return "ditolak";
  return req.manager === "disetujui" && req.hr === "disetujui" ? "disetujui" : "menunggu";
}

/** Catat keputusan satu pihak. Bila pengajuan jadi disetujui penuh, hari kerjanya masuk tanggal cuti (mengurangi jam kosong). */
export function decideLeave(member: Member, id: string, by: "manager" | "hr", approve: boolean): Member {
  const req = member.leaveRequests?.find(r => r.id === id);
  if (!req || req[by] !== "menunggu" || leaveStatus(req) !== "menunggu") return member;
  const next = { ...req, [by]: approve ? "disetujui" : "ditolak" };
  const leaveDates = leaveStatus(next) === "disetujui"
    ? [...new Set([...member.leaveDates, ...workdays(next.start, next.end)])].sort()
    : member.leaveDates;
  return { ...member, leaveDates, leaveRequests: member.leaveRequests?.map(r => r.id === id ? next : r) };
}

/** Validasi form pengajuan; kembalikan pesan galat atau null. */
export function leaveError(start: string, end: string, reason: string, today: string): string | null {
  if (!start || !end) return "Pilih tanggal mulai dan selesai.";
  if (start < today) return "Tanggal mulai tidak boleh sebelum hari ini.";
  if (end < start) return "Tanggal selesai tidak boleh sebelum tanggal mulai.";
  if (!workdays(start, end).length) return "Rentang tanggal tidak berisi hari kerja.";
  if (reason.trim().length < 10) return "Tulis alasan minimal 10 karakter.";
  return null;
}
