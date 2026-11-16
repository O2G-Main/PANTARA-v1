import type {
  Assignment,
  Competency,
  Decision,
  Member,
  MemberCompetency,
  PresetId,
  Priority,
  Project,
  Task,
  TaskDna,
  TaskStatus,
  Weights,
} from "@/lib/demo/types";
import type { BatchPair } from "@/lib/engine/batch";
import type { ReplanRisk, WeekBucket } from "@/lib/engine/capacity";
import type { Graph } from "@/lib/engine/graph";
import type { AtRiskSkill } from "@/lib/engine/skills";
import type { Candidate, EngineSettings, FilteredOut } from "@/lib/engine/score";
import type { Tone } from "@/lib/engine/whatif";

export const DATA_MODE: "api" | "mock" = process.env.NEXT_PUBLIC_DATA_MODE === "mock" ? "mock" : "api";

export interface NotifyPrefs {
  assigned: boolean;
  rejected: boolean;
  reminder: boolean;
}

export type ServerRole = "admin" | "manajer" | "anggota";

export interface AuthUser {
  id: string;
  organizationId: string;
  memberId?: string;
  email: string;
  name: string;
  role: ServerRole;
  home: "/dashboard" | "/saya";
  isActive: boolean;
  notifyPrefs: NotifyPrefs;
}

export interface WorkPeriod {
  id: string;
  organizationId?: string;
  code: string;
  label: string;
  start: string;
  end: string;
  isActive: boolean;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  periodType: "mingguan" | "dua-mingguan";
  hoursPerWeek: number;
  workDays: string[];
  holidays: string[];
  baselineMinutes: number;
  subscriptionPlan: string;
  onboardingDone: boolean;
}

export interface BootstrapPayload {
  organization: Organization;
  period: WorkPeriod;
  periods: WorkPeriod[];
  settings: EngineSettings;
  competencies: Competency[];
  members: Member[];
  projects: Project[];
  tasks: Task[];
  decisions: Decision[];
  today: string;
  now: string;
}

export interface InvitationPreview {
  organizationName: string;
  email: string;
  name: string;
  roleTitle: string;
  accessRole: ServerRole;
  invitedByName: string;
  expiresAt: string;
}

export interface PendingInvitation {
  id: string;
  memberId: string;
  email: string;
  name: string;
  roleTitle: string;
  accessRole: ServerRole;
  expiresAt: string;
}

export interface BillingSummary {
  plan: string;
  activeSeats: number;
  includedSeats: number;
  pendingInvites: number;
  statusLabel: string;
}

interface OverrunSummary {
  ratio: number;
  n: number;
  estimated: boolean;
}

export interface CandidatesPayload {
  task: Task;
  candidates: Candidate[];
  filtered: FilteredOut[];
  weights: Weights;
  overrun: OverrunSummary;
}

export interface SimulationPayload {
  rows: { member: Member; before: number; after: number; available: number; added: number }[];
  conflicts: { tone: Tone; text: string }[];
  peakBefore: number;
  peakAfter: number;
  teamBefore: number;
  teamAfter: number;
}

export interface AvailabilitySnapshot {
  memberId: string;
  periodId: string;
  availableHours: number | null;
  weeklyLimit: number;
  leaveDates: string[];
}

export interface SelfOverviewPayload {
  member: Member;
  tasks: Task[];
  previousAvailability?: AvailabilitySnapshot;
}

export interface ReportPayload {
  baselineMinutes: number;
  efficiency: number;
  stats: { n: number; assigned: number; avgMs: number; rank1: number; top3: number; override: number };
  stability: { assigned: number; stable: number; rate: number };
  accuracy: { n: number; absError: number; exactRate: number };
  overrun: OverrunSummary;
  completeMembers: number;
  totalMembers: number;
}

export interface CapacityPayload {
  period: WorkPeriod;
  overrun: OverrunSummary;
  replanRisks: ReplanRisk[];
  weekly: Record<string, WeekBucket[]>;
}

export interface ServerNotice {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  kind: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface RawErrorPayload {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

let inflightRefresh: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

async function request<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError(0, "network_error", "Koneksi ke server Pantara terputus. Periksa koneksi lalu coba lagi.");
  }

  if (res.status === 401 && allowRefresh && !path.startsWith("/auth/")) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return request<T>(path, init, false);
    }
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const errBody = (parsed as RawErrorPayload | null)?.error;
    throw new ApiError(
      res.status,
      errBody?.code || `http_${res.status}`,
      errBody?.message || `Permintaan gagal (${res.status}).`,
      errBody?.fields,
    );
  }
  return parsed as T;
}

export const api = {
  auth: {
    register: (body: { orgName: string; name: string; email: string; password: string }) =>
      request<{ user: AuthUser }>("/auth/register", { method: "POST", body: JSON.stringify(body) }, false),
    login: (body: { email: string; password: string; rememberMe: boolean }) =>
      request<{ user: AuthUser }>("/auth/login", { method: "POST", body: JSON.stringify(body) }, false),
    refresh: () => request<{ user: AuthUser }>("/auth/refresh", { method: "POST" }, false),
    logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }, false),
    logoutAll: () => request<{ ok: boolean }>("/auth/logout-all", { method: "POST" }),
    forgotPassword: (email: string) =>
      request<{ ok: boolean }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }, false),
    resetPassword: (body: { token: string; password: string }) =>
      request<{ ok: boolean }>("/auth/reset-password", { method: "POST", body: JSON.stringify(body) }, false),
    inspectInvite: (token: string) =>
      request<InvitationPreview>(`/auth/invitations/${encodeURIComponent(token)}`, {}, false),
    acceptInvite: (body: { token: string; name: string; password: string }) =>
      request<{ user: AuthUser }>("/auth/accept-invite", { method: "POST", body: JSON.stringify(body) }, false),
    me: () => request<{ user: AuthUser }>("/auth/me", {}, false),
    updateProfile: (body: { name: string; email: string }) =>
      request<{ user: AuthUser }>("/account/profile", { method: "PATCH", body: JSON.stringify(body) }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<{ ok: boolean }>("/account/password", { method: "POST", body: JSON.stringify(body) }),
    updateNotifyPrefs: (prefs: NotifyPrefs) =>
      request<{ notifyPrefs: NotifyPrefs }>("/account/notifications", { method: "PATCH", body: JSON.stringify(prefs) }),
  },
  workspace: {
    bootstrap: (periodId?: string) =>
      request<BootstrapPayload>(`/workspace/bootstrap${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ""}`),
    getOrg: () => request<{ organization: Organization }>("/workspace"),
    updateOrg: (body: {
      name: string;
      timezone: string;
      periodType: "mingguan" | "dua-mingguan";
      hoursPerWeek: number;
      workDays: string[];
      holidays: string[];
    }) => request<{ organization: Organization }>("/workspace", { method: "PATCH", body: JSON.stringify(body) }),
    completeOnboarding: (body: {
      hoursPerWeek: number;
      periodType: "mingguan" | "dua-mingguan";
      invites: { name: string; email: string; role: string }[];
    }) => request<{ members: Member[]; onboardingDone: boolean }>("/workspace/onboarding", { method: "POST", body: JSON.stringify(body) }),
    listPeriods: () => request<{ periods: WorkPeriod[] }>("/workspace/periods"),
    createPeriod: (body: { label: string; start: string; end: string; activate?: boolean }) =>
      request<{ period: WorkPeriod }>("/workspace/periods", { method: "POST", body: JSON.stringify(body) }),
    activatePeriod: (id: string) =>
      request<{ period: WorkPeriod }>(`/workspace/periods/${encodeURIComponent(id)}/activate`, { method: "POST" }),
    getSettings: () => request<{ settings: EngineSettings }>("/workspace/settings"),
    updateSettings: (settings: EngineSettings) =>
      request<{ settings: EngineSettings }>("/workspace/settings", { method: "PATCH", body: JSON.stringify(settings) }),
    getBilling: () => request<{ billing: BillingSummary }>("/workspace/billing"),
  },
  competencies: {
    list: () => request<{ competencies: Competency[] }>("/competencies"),
    create: (body: { name: string; category: string }) =>
      request<{ competency: Competency }>("/competencies", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { name: string; category: string }) =>
      request<{ competency: Competency }>(`/competencies/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/competencies/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  projects: {
    list: () => request<{ projects: Project[] }>("/projects"),
    get: (id: string) => request<{ project: Project }>(`/projects/${encodeURIComponent(id)}`),
    create: (body: { name: string; client: string; dueDate: string }) =>
      request<{ project: Project }>("/projects", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { name: string; client: string; dueDate: string }) =>
      request<{ project: Project }>(`/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  members: {
    list: (withSettings = false) =>
      request<{ members: Member[]; invitations?: PendingInvitation[] }>(`/members${withSettings ? "?settings=1" : ""}`),
    get: (id: string) => request<{ member: Member }>(`/members/${encodeURIComponent(id)}`),
    create: (body: { name: string; email: string; role: string; access: ServerRole }) =>
      request<{ member: Member; inviteToken?: string }>("/members", { method: "POST", body: JSON.stringify(body) }),
    resendInvite: (id: string) =>
      request<{ ok: boolean; inviteToken?: string }>(`/members/${encodeURIComponent(id)}/invite-resend`, { method: "POST" }),
    update: (id: string, body: { name: string; role: string; email: string; weeklyLimit: number }) =>
      request<{ member: Member }>(`/members/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    saveAvailability: (id: string, body: { periodId?: string; availableHours: number | null; weeklyLimit: number; leaveDates: string[] }) =>
      request<{ member: Member }>(`/members/${encodeURIComponent(id)}/availability`, { method: "PUT", body: JSON.stringify(body) }),
    verifyCompetency: (id: string, compId: string) =>
      request<{ member: Member }>(`/members/${encodeURIComponent(id)}/competencies/${encodeURIComponent(compId)}/verify`, { method: "POST" }),
    setAccess: (id: string, body: { access?: ServerRole; isActive?: boolean }) =>
      request<{ member: Member }>(`/members/${encodeURIComponent(id)}/access`, { method: "PATCH", body: JSON.stringify(body) }),
    remind: (id: string) =>
      request<{ ok: boolean }>(`/members/${encodeURIComponent(id)}/remind`, { method: "POST" }),
  },
  tasks: {
    list: (periodId?: string) =>
      request<{ tasks: Task[] }>(`/tasks${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ""}`),
    get: (id: string) => request<{ task: Task; decisions: Decision[] }>(`/tasks/${encodeURIComponent(id)}`),
    create: (body: { projectId: string; title: string; description: string; dueDate: string; priority: Priority; draft: boolean }) =>
      request<{ task: Task }>("/tasks", { method: "POST", body: JSON.stringify(body) }),
    update: (
      id: string,
      body: Partial<{ projectId: string; title: string; description: string; dueDate: string; priority: Priority; status: TaskStatus }>,
    ) => request<{ task: Task }>(`/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) => request<{ ok: boolean }>(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }),
    flowStart: (id: string) => request<{ ok: boolean }>(`/tasks/${encodeURIComponent(id)}/flow-start`, { method: "POST" }),
    analyzeDna: (id: string) => request<{ task: Task }>(`/tasks/${encodeURIComponent(id)}/analyze-dna`, { method: "POST" }),
    confirmDna: (id: string, dna: TaskDna) =>
      request<{ task: Task }>(`/tasks/${encodeURIComponent(id)}/confirm-dna`, { method: "PUT", body: JSON.stringify(dna) }),
    candidates: (id: string, preset?: PresetId) =>
      request<CandidatesPayload>(`/tasks/${encodeURIComponent(id)}/candidates${preset ? `?preset=${encodeURIComponent(preset)}` : ""}`),
    simulate: (id: string, assignments: Assignment[]) =>
      request<{ simulation: SimulationPayload }>(`/tasks/${encodeURIComponent(id)}/simulate`, { method: "POST", body: JSON.stringify({ assignments }) }),
    assign: (id: string, body: { assignments: Assignment[]; preset: PresetId; reasonCode?: string; note?: string }) =>
      request<{ task: Task; decision: Decision }>(`/tasks/${encodeURIComponent(id)}/assign`, { method: "POST", body: JSON.stringify(body) }),
    reject: (id: string, body: { preset: PresetId; reasonCode: string; note?: string }) =>
      request<{ task: Task; decision: Decision }>(`/tasks/${encodeURIComponent(id)}/reject`, { method: "POST", body: JSON.stringify(body) }),
    unassign: (id: string) => request<{ task: Task }>(`/tasks/${encodeURIComponent(id)}/unassign`, { method: "POST" }),
    updateStatus: (id: string, body: { status: TaskStatus; actualHours?: number }) =>
      request<{ task: Task }>(`/tasks/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify(body) }),
    batchPreview: (preset?: PresetId) =>
      request<{ pairs: BatchPair[] }>(`/batch/preview${preset ? `?preset=${encodeURIComponent(preset)}` : ""}`),
    batchCommit: (body: { preset: PresetId; items: { taskId: string; memberId: string; hours: number }[] }) =>
      request<{ tasks: Task[] }>("/batch/commit", { method: "POST", body: JSON.stringify(body) }),
  },
  self: {
    overview: () => request<SelfOverviewPayload>("/saya/overview"),
    updateProfile: (body: { competencies: MemberCompetency[]; prefers: string[]; avoids: string[] }) =>
      request<{ member: Member }>("/saya/profile", { method: "PATCH", body: JSON.stringify(body) }),
    updateAvailability: (body: { availableHours: number; weeklyLimit: number; leaveDates: string[] }) =>
      request<{ member: Member }>("/saya/availability", { method: "PUT", body: JSON.stringify(body) }),
    respond: (id: string, body: { accept: boolean; reason?: string }) =>
      request<{ task: Task }>(`/saya/tasks/${encodeURIComponent(id)}/respond`, { method: "POST", body: JSON.stringify(body) }),
    updateProgress: (id: string, body: { remainingHours?: number; complete?: boolean; actualHours?: number }) =>
      request<{ task: Task }>(`/saya/tasks/${encodeURIComponent(id)}/progress`, { method: "PATCH", body: JSON.stringify(body) }),
  },
  analytics: {
    decisions: () => request<{ decisions: Decision[] }>("/decisions"),
    report: () => request<ReportPayload>("/report"),
    updateBaseline: (baselineMinutes: number) =>
      request<ReportPayload>("/report/baseline", { method: "PATCH", body: JSON.stringify({ baselineMinutes }) }),
    capacity: (periodId?: string) =>
      request<CapacityPayload>(`/capacity${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ""}`),
    skillMap: () => request<{ competencies: Competency[]; members: Member[]; atRisk: AtRiskSkill[] }>("/skill-map"),
    relationGraph: () => request<Graph>("/relation-graph"),
    notifications: () => request<{ notifications: ServerNotice[] }>("/notifications"),
    markNotificationRead: (id: string) => request<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }),
    markAllNotificationsRead: () => request<{ ok: boolean }>("/notifications/read-all", { method: "POST" }),
  },
};
