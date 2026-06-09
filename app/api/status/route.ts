import { NextResponse } from "next/server";
import { getStatus } from "@/lib/betterstack";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getStatus();
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
