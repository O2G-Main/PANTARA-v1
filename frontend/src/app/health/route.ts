export function GET() {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE === "mock" ? "mock" : "api";
  return Response.json({ status: "ok", service: "pantara-frontend", mode });
}
