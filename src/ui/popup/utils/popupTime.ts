export function formatDateTimeAmPm(ts: number) {
  const d = new Date(ts);
  const date = d.toLocaleDateString("es-DO");
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${date} ${time}`;
}
