export const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  const paddedSeconds = String(seconds).padStart(2, "0");
  const paddedMillis = String(millis).padStart(3, "0");
  return `${minutes}:${paddedSeconds}.${paddedMillis}`;
};

export const formatClock = (date: Date): string =>
  date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export const nowUtcMs = () => Date.now();
