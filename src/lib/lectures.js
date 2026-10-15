/** Every slot occurrence (one per day it meets) for a class, sorted chronologically from
 *  fromDate, skipping any date in holidayDates. Each entry in a multi-day-per-week
 *  timetable is its own lecture occurrence. */
function* occurrencesFrom(timetableSlots, classId, fromDate, holidaySet) {
  const dows = timetableSlots.filter((s) => s.class_id === classId).map((s) => s.day_of_week);
  if (dows.length === 0) return;
  const dowSet = new Set(dows);
  // slots can repeat the same day_of_week (two periods same day) - count each as separate lecture
  const perDayCount = {};
  for (const d of dows) perDayCount[d] = (perDayCount[d] || 0) + 1;
  for (let d = new Date(fromDate); ; d.setDate(d.getDate() + 1)) {
    if (dowSet.has(d.getDay())) {
      const key = d.toISOString().slice(0, 10);
      if (!holidaySet.has(key)) {
        for (let i = 0; i < perDayCount[d.getDay()]; i++) yield key;
      }
    }
    if (d.getFullYear() > fromDate.getFullYear() + 2) return; // safety stop
  }
}

/** The calendar date lecture N falls on, counting slot occurrences for this class from
 *  the term's start date, skipping holidays. Null if there's no timetable or term yet. */
export function resolveLectureDate(timetableSlots, classId, lectureNumber, termStartDate, holidayDates) {
  if (!termStartDate || !lectureNumber || lectureNumber < 1) return null;
  const holidaySet = new Set(holidayDates);
  const gen = occurrencesFrom(timetableSlots, classId, new Date(termStartDate + "T00:00:00"), holidaySet);
  let i = 0, result = null;
  for (const dateKey of gen) {
    i++;
    if (i === lectureNumber) { result = dateKey; break; }
  }
  return result;
}

/** How many lecture occurrences for this class should have happened by (and including)
 *  today, counting from the term's start date and skipping holidays - "what lecture
 *  number should we be on by now". */
export function expectedLectureNumberToday(timetableSlots, classId, termStartDate, holidayDates, today) {
  if (!termStartDate) return null;
  const holidaySet = new Set(holidayDates);
  const todayKey = today.toISOString().slice(0, 10);
  const gen = occurrencesFrom(timetableSlots, classId, new Date(termStartDate + "T00:00:00"), holidaySet);
  let count = 0;
  for (const dateKey of gen) {
    if (dateKey > todayKey) break;
    count++;
  }
  return count;
}

/** Which term's date range today falls in, or the most recent one that's already started. */
export function currentTerm(terms, today) {
  const todayKey = today.toISOString().slice(0, 10);
  const within = terms.find((t) => todayKey >= t.start_date && todayKey <= t.end_date);
  if (within) return within;
  const started = terms.filter((t) => t.start_date <= todayKey).sort((a, b) => b.start_date.localeCompare(a.start_date));
  return started[0] || null;
}
