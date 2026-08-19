function timeStrToDate(hhmmss, dateBase) {
  const [h, m] = hhmmss.split(":").map(Number);
  const d = new Date(dateBase);
  d.setHours(h, m, 0, 0);
  return d;
}

export function computeSchedule(tasks, now, isToday) {
  const sorted = [...tasks].sort((a, b) => timeStrToDate(a.time, now) - timeStrToDate(b.time, now));
  let pointer = null;
  const out = [];
  for (const t of sorted) {
    const base = timeStrToDate(t.time, now);
    let effectiveStart = base, delayMin = 0, conflict = false, overdue = false;
    if (t.status === "done") {
      effectiveStart = t.actual_start ? new Date(t.actual_start) : base;
      const end = new Date(effectiveStart.getTime() + t.duration * 60000);
      pointer = pointer && pointer > end ? pointer : end;
    } else if (t.status === "skipped") {
      effectiveStart = base;
    } else {
      let candidate = base;
      if (pointer && pointer > candidate && t.anchored) conflict = true;
      else if (pointer && pointer > candidate && !t.anchored) candidate = pointer;
      if (isToday && !t.anchored && now > new Date(base.getTime() + t.duration * 60000) && candidate <= now) {
        candidate = pointer && pointer > now ? pointer : now;
        overdue = true;
      }
      effectiveStart = candidate;
      delayMin = Math.round((effectiveStart - base) / 60000);
      const end = new Date(effectiveStart.getTime() + t.duration * 60000);
      if (t.anchored) {
        const anchoredEnd = new Date(base.getTime() + t.duration * 60000);
        pointer = pointer && pointer > anchoredEnd ? pointer : anchoredEnd;
      } else pointer = end;
      if (isToday && t.anchored && now > new Date(base.getTime() + t.duration * 60000)) overdue = true;
    }
    out.push({ ...t, base, effectiveStart, delayMin, conflict, overdue });
  }
  return out;
}
