import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

describe("api client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("melempar ApiError dengan status, code, dan fields dari envelope server", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "Data tidak valid.",
            fields: { title: "Judul wajib diisi" },
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(api.tasks.create({
      projectId: "klinik",
      title: "",
      description: "",
      dueDate: "2026-10-02",
      priority: "normal",
      draft: true,
    })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      code: "validation_error",
      message: "Data tidak valid.",
      fields: { title: "Judul wajib diisi" },
    });
  });

  it("melakukan single-flight refresh sekali saat beberapa request bersamaan mendapat 401", async () => {
    let refreshCount = 0;
    let tasksCall = 0;
    let reportCall = 0;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/v1/auth/refresh") {
        refreshCount += 1;
        return new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 });
      }
      if (url === "/api/v1/tasks") {
        tasksCall += 1;
        if (tasksCall === 1) return new Response(JSON.stringify({ error: { code: "unauthorized", message: "expired" } }), { status: 401 });
        return new Response(JSON.stringify({ tasks: [] }), { status: 200 });
      }
      if (url === "/api/v1/report") {
        reportCall += 1;
        if (reportCall === 1) return new Response(JSON.stringify({ error: { code: "unauthorized", message: "expired" } }), { status: 401 });
        return new Response(JSON.stringify({ baselineMinutes: 24 }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const [tRes, rRes] = await Promise.all([api.tasks.list(), api.analytics.report()]);
    expect(tRes).toEqual({ tasks: [] });
    expect(rRes).toMatchObject({ baselineMinutes: 24 });
    expect(refreshCount).toBe(1);
    expect(tasksCall).toBe(2);
    expect(reportCall).toBe(2);
  });

  it("menangani kegagalan jaringan dengan ApiError status 0", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    try {
      await api.workspace.bootstrap();
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(0);
      expect((err as ApiError).code).toBe("network_error");
    }
  });

  it("memanggil endpoint corporate-first dan HR dengan path, method, serta payload yang sesuai", async () => {
    const calls: { url: string; method?: string; body?: string }[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, method: init?.method, body: typeof init?.body === "string" ? init.body : undefined });
      return new Response(JSON.stringify({ ok: true, rows: [], divisions: [], task: {}, member: {}, request: {}, review: {}, settings: {}, config: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await api.self.requestExtraTime("TGS-0164", { hours: 3, reason: "Tambah skenario regresi laporan." });
    await api.self.createLeaveRequest({ start: "2026-10-05", end: "2026-10-06", type: "tahunan", reason: "Acara keluarga luar kota." });
    await api.tasks.decideExtraTime("TGS-0164", true);
    await api.tasks.importCsv({ csv: "judul,proyek", dryRun: true });
    await api.tasks.updateResultNote("TGS-0128", "Rapi dan teruji.");
    await api.members.decideLeave("fikri", "CUTI-fikri-1", true);
    await api.members.importCsv({ csv: "nama,email,jabatan,jenis,tim,divisi,jam", dryRun: true });
    await api.hr.createDivision("Produk & Riset");
    await api.hr.renameDivision("Produk & Riset", "Engineering");
    await api.hr.placeMembers({ ids: ["bima"], division: "Engineering", team: "Backend" });
    await api.hr.updateSettings({ weeklyHours: 40, reserveHours: 4 });
    await api.hr.createRequest({ title: "Monitor", description: "Butuh monitor tambahan untuk kerja." });
    await api.hr.decideLeave("CUTI-fikri-1", true);
    await api.hr.createPerformanceReview({
      memberId: "bima",
      period: "2026-10",
      note: "Konsisten",
      criteria: [{ id: "collaboration", score: 90 }],
    });

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/v1/saya/tasks/TGS-0164/extra-time",
      "POST /api/v1/saya/leave-requests",
      "POST /api/v1/tasks/TGS-0164/extra-time/decision",
      "POST /api/v1/tasks/import",
      "PATCH /api/v1/tasks/TGS-0128/result-note",
      "POST /api/v1/members/fikri/leave-requests/CUTI-fikri-1/decision",
      "POST /api/v1/members/import",
      "POST /api/v1/hr/divisions",
      "PATCH /api/v1/hr/divisions/Produk%20%26%20Riset",
      "POST /api/v1/hr/members/place",
      "PUT /api/v1/hr/settings",
      "POST /api/v1/hr/requests",
      "POST /api/v1/hr/leave-requests/CUTI-fikri-1/decision",
      "POST /api/v1/manager/performance-reviews",
    ]);
  });
});
