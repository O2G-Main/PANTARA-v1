// Tipe domain mockup M0; bentuknya mengikuti model data docs/03-ARCHITECTURE.md §3.

export type Priority = "rendah" | "normal" | "tinggi";
export type TaskStatus = "draf" | "belum" | "menunggu" | "berjalan" | "selesai";
export type Level = 0 | 1 | 2 | 3;
export type CompetencySource = "klaim" | "verifikasi" | "riwayat";
export type EffortSize = "S" | "M" | "L" | "XL";
export type PresetId = "seimbang" | "tenggat" | "ratakan" | "sebar";

export interface Competency {
  id: string;
  name: string;
  category: string;
}

export interface MemberCompetency {
  id: string;
  level: Level;
  source: CompetencySource;
}

export interface Member {
  id: string;
  name: string;
  initials: string;
  role: string;
  /** Jenis hubungan kerja; kosong = karyawan. Freelancer boleh menolak/minta perubahan penugasan, karyawan meminta tambahan waktu. */
  employmentType?: Employment;
  team?: string;
  division?: string;
  email: string;
  /** Jam tersedia di periode aktif; null = belum diisi karyawan. */
  availableHours: number | null;
  leaveDates: string[];
  /** Batas kerja mingguan yang ditentukan karyawan (syarat wajib). */
  weeklyLimit: number;
  workHoursOverride?: number;
  reserveHoursOverride?: number;
  competencies: MemberCompetency[];
  /** Kompetensi yang disukai / dihindari (faktor preferensi di R). */
  prefers: string[];
  avoids: string[];
  /** URL foto profil; kosong = belum diunggah (tampil inisial). */
  photo?: string;
  /** Peran akses ruang kerja. */
  access: "admin" | "manajer" | "anggota" | "hr";
  isActive?: boolean;
  leaveRequests?: LeaveRequest[];
}

export type LeaveType = "tahunan" | "sakit" | "izin";
export type Approval = "menunggu" | "disetujui" | "ditolak";

/** Pengajuan cuti anggota. Manajer dan HR menyetujui paralel; berlaku bila keduanya setuju. */
export interface LeaveRequest {
  id: string;
  start: string;
  end: string;
  type: LeaveType;
  reason: string;
  requestedAt: string;
  manager: Approval;
  hr: Approval;
}

export type Employment = "karyawan" | "freelancer";

/** Permintaan tambahan jam estimasi dari anggota; tenggat tetap, manajer yang memutuskan. */
interface ExtraTimeRequest {
  memberId: string;
  hours: number;
  reason: string;
  requestedAt: string;
  status: "menunggu" | "disetujui" | "ditolak";
}

export interface Project {
  id: string;
  name: string;
  client: string;
  dueDate: string;
}

export interface Requirement {
  competencyId: string;
  level: Level;
  /** Probabilitas dari 5 sampel AI (0-1). */
  p: number;
  /** Kalimat sumber di deskripsi tugas. */
  quote: string;
}

export interface TaskDna {
  requirements: Requirement[];
  effortSize: EffortSize;
  effortP: number;
  effortHours: number;
  complexity: Level;
  complexitySpread: number;
  dependencies: { taskId: string; p: number }[];
  model: string;
  prompt: string;
  confirmed: boolean;
}

export interface Assignment {
  memberId: string;
  /** Jam yang dialokasikan ke periode aktif. */
  hours: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  dueDate: string;
  /** Jam tenggat "HH:MM" WIB; kosong = 17:00. */
  dueTime?: string;
  priority: Priority;
  status: TaskStatus;
  assignments: Assignment[];
  /** Sisa estimasi jam untuk tugas berjalan. */
  remainingHours: number;
  createdAt: string;
  dna?: TaskDna;
  /** Kompetensi yang dipakai tugas selesai (riwayat relevan). */
  competencyIds: string[];
  responseReason?: string;
  changeRequest?: { memberId: string; reason: string; status: "pending" | "reviewed" };
  /** Jam aktual yang dicatat saat tugas ditandai selesai (satu angka, bukan time tracking); dasar kalibrasi estimasi. */
  actualHours?: number;
  completedAt?: string;
  qualityScore?: number;
  /** Pekerjaan yang dikelola di luar PANTARA (nama sistem/klien); dicatat agar ikut menghitung beban. */
  externalSource?: string;
  extraTime?: ExtraTimeRequest;
  /** Catatan hasil dari manajer (teks, tanpa skor, tidak dipakai rekomendasi). */
  resultNote?: string;
}

export interface Decision {
  id: string;
  taskId: string;
  memberIds: string[];
  /** Peringkat kandidat yang dipilih (1-3) atau null = override / ditolak. */
  rank: number | null;
  /** Manajer menolak semua rekomendasi; memberIds kosong, tugas tetap belum ditugaskan. */
  rejected?: boolean;
  preset: PresetId;
  reasonCode?: string;
  note?: string;
  decidedAt: string;
  /** Tp: lama keputusan dari tugas dibuat sampai ditetapkan (ms). */
  decisionMs: number;
  conflictsSeen: number;
}

export interface Weights {
  k: number;
  c: number;
  a: number;
  r: number;
  f: number;
}


interface PerformanceCriterion {
  id: string;
  name: string;
  weight: number;
  active: boolean;
}

export interface PerformanceConfig {
  automaticWeight: number;
  criteria: PerformanceCriterion[];
}

export interface PerformanceReview {
  id: string;
  memberId: string;
  period: string;
  note: string;
  criteria: { id: string; name: string; weight: number; score: number }[];
  automaticWeight: number;
  automaticScore: number | null;
  onTimeScore: number | null;
  qualityScore: number | null;
  author: string;
}

export interface HrRequest {
  id: string;
  sender: string;
  senderRole: string;
  title: string;
  description: string;
  createdAt: string;
  handled?: boolean;
  read: boolean;
}
