import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatDuration } from "@/lib/time";

const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    if (value == null) return "";
    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes("\n")) {
      return `"${stringValue.replaceAll('"', '""')}"`;
    }
    return stringValue;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("laps")
    .select("*, drivers(number,name)")
    .eq("session_id", sessionId)
    .order("driver_id")
    .order("lap_index");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((lap) => ({
    session_id: lap.session_id,
    driver_id: lap.driver_id,
    driver_number: lap.drivers?.number,
    driver_name: lap.drivers?.name,
    lap_index: lap.lap_index,
    lap_ms: lap.lap_ms,
    lap_formatted: formatDuration(lap.lap_ms),
    absolute_ms: lap.absolute_ms,
    valid: lap.valid,
    created_at: lap.created_at,
  }));

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="dbgp_${sessionId}.csv"`,
    },
  });
}
