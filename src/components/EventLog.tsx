"use client";

import { useMemo } from "react";
import { useSessionStore } from "@/store/useSessionStore";

export const EventLog = () => {
  const events = useSessionStore((state) => state.events);

  const ordered = useMemo(
    () =>
      [...events].sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? "")
      ),
    [events]
  );

  return (
    <div className="space-y-2 overflow-y-auto pr-2 text-sm text-slate-300 scrollbar-thin">
      {ordered.map((event) => (
        <div key={event.id} className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
          <p className="font-medium text-slate-100">{event.type}</p>
          {event.payload ? (
            <pre className="mt-1 text-xs text-slate-400">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          ) : null}
        </div>
      ))}
      {!ordered.length ? (
        <p className="text-xs text-slate-500">No events yet.</p>
      ) : null}
    </div>
  );
};

export default EventLog;
