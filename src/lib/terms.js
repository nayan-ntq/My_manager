/** Counts working days between a term's start and end date (inclusive), excluding its
 *  weekly off-days (0=Sunday..6=Saturday) and any holiday dates that fall in range. */
export function computeWorkingDays(term, holidayDates = []) {
  const start = new Date(term.start_date + "T00:00:00");
  const end = new Date(term.end_date + "T00:00:00");
  if (end < start) return 0;
  const offDays = new Set(term.weekly_off_days || [0]);
  const holidaySet = new Set(holidayDates);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (offDays.has(d.getDay())) continue;
    const key = d.toISOString().slice(0, 10);
    if (holidaySet.has(key)) continue;
    count++;
  }
  return count;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
