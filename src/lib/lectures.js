const pad = (n) => String(n).padStart(2, "0");
/** Local calendar date as YYYY-MM-DD. (toISOString shifts the day for timezones ahead of UTC.) */
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Every slot occurrence (one per day it meets) for a class, in date order from fromDate, skipping
 *  any date in holidaySet. Each entry in a multi-day-per-week timetable is its own lecture. */
function* occurrencesFrom(timetableSlots, classId, fromDate, holidaySet) {
  const dows = timetableSlots.filter((s) => s.class_id === classId).map((s) => s.day_of_week);
  if (dows.length === 0) return;
  const dowSet = new Set(dows);
  const perDayCount = {};
  for (const d of dows) perDayCount[d] = (perDayCount[d] || 0) + 1;
  for (let d = new Date(fromDate); ; d.setDate(d.getDate() + 1)) {
    if (dowSet.has(d.getDay())) {
      const key = dateKey(d);
      if (!holidaySet.has(key)) {
        for (let i = 0; i < perDayCount[d.getDay()]; i++) yield key;
      }
    }
    if (d.getFullYear() > fromDate.getFullYear() + 2) return; // safety stop
  }
}

/** The calendar date lecture N falls on, counting from the term's start and skipping holidays and off days. */
export function resolveLectureDate(timetableSlots, classId, lectureNumber, termStartDate, holidayDates) {
  if (!termStartDate || !lectureNumber || lectureNumber < 1) return null;
  const holidaySet = new Set(holidayDates);
  const gen = occurrencesFrom(timetableSlots, classId, new Date(termStartDate + "T00:00:00"), holidaySet);
  let i = 0;
  for (const dateKeyValue of gen) {
    i++;
    if (i === lectureNumber) return dateKeyValue;
  }
  return null;
}

/** How many lectures should have happened by (and including) today - "what lecture should we be on". */
export function expectedLectureNumberToday(timetableSlots, classId, termStartDate, holidayDates, today) {
  if (!termStartDate) return null;
  const holidaySet = new Set(holidayDates);
  const todayStr = dateKey(today);
  const gen = occurrencesFrom(timetableSlots, classId, new Date(termStartDate + "T00:00:00"), holidaySet);
  let count = 0;
  for (const k of gen) {
    if (k > todayStr) break;
    count++;
  }
  return count;
}

/** Which term's date range today falls in, or the most recent one that has already started. */
export function currentTerm(terms, today) {
  const todayStr = dateKey(today);
  const within = terms.find((t) => todayStr >= t.start_date && todayStr <= t.end_date);
  if (within) return within;
  const started = terms.filter((t) => t.start_date <= todayStr).sort((a, b) => b.start_date.localeCompare(a.start_date));
  return started[0] || null;
}

/**
 * Weekly-off dates for a term. With a grade group: its off weekdays plus its Saturday rule
 * (every Saturday, 2nd and 4th, 1st/3rd/5th, or working). With no group: the term's own off days.
 */
export function termOffDates(term, group) {
  const out = [];
  const fixed = new Set(group ? (group.off_weekdays || []) : (term.weekly_off_days || [0]));
  const rule = group ? group.saturday_rule : (fixed.has(6) ? "all" : "working");
  const end = new Date(term.end_date + "T00:00:00");
  for (let d = new Date(term.start_date + "T00:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    let off;
    if (dow === 6) {
      const nth = Math.ceil(d.getDate() / 7); // which Saturday of the month
      off = rule === "all" || (rule === "alt_2_4" && (nth === 2 || nth === 4)) || (rule === "alt_1_3" && (nth === 1 || nth === 3 || nth === 5));
    } else {
      off = fixed.has(dow);
    }
    if (off) out.push(dateKey(d));
  }
  return out;
}
