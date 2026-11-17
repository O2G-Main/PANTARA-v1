import { describe, expect, it } from "vitest";
import { authenticate, authUserToAccount } from "./session";

describe("authenticate", () => {
  it("mengarahkan admin dan manajer ke Dashboard dan anggota ke Beranda saya", () => {
    expect(authenticate("krisna@pantara.id", "pantara2026")).toMatchObject({ role: "admin", home: "/dashboard" });
    expect(authenticate("manajer@pantara.id", "pantara2026")).toMatchObject({ role: "manajer", home: "/dashboard" });
    expect(authenticate("bima@pantara.id", "pantara2026")).toMatchObject({ role: "anggota", memberId: "bima", home: "/saya" });
  });

  it("tidak membedakan huruf besar dan spasi di email", () => {
    expect(authenticate("  Krisna@Pantara.ID ", "pantara2026")?.name).toBe("Krisna Panca");
  });

  it("menolak sandi salah dan akun lama", () => {
    expect(authenticate("krisna@pantara.id", "salah")).toBeNull();
    expect(authenticate("krisna@arunika.id", "pantara2026")).toBeNull();
  });

  it("tidak membawa sandi keluar dari modul", () => {
    expect(authenticate("bima@pantara.id", "pantara2026")).not.toHaveProperty("password");
  });

  it("memetakan AuthUser dari API menjadi Account lengkap", () => {
    const acc = authUserToAccount({
      id: "usr-1",
      organizationId: "org-1",
      memberId: "bima",
      email: "bima@pantara.id",
      name: "Bima Pradana",
      role: "anggota",
      home: "/saya",
      isActive: true,
      notifyPrefs: { assigned: true, rejected: true, reminder: true },
    });
    expect(acc).toMatchObject({
      id: "usr-1",
      organizationId: "org-1",
      initials: "BP",
      role: "anggota",
      home: "/saya",
      memberId: "bima",
    });
  });
});
