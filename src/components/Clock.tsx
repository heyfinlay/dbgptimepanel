"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/time";

export const Clock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-mono text-2xl tracking-tight text-slate-200" aria-live="polite">
      {formatClock(now)}
    </div>
  );
};

export default Clock;
