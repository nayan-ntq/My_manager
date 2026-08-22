import { Dumbbell, HeartPulse, BookOpen, Briefcase, CalendarClock } from "lucide-react";

export const CATEGORIES = {
  professional: { label: "Professional", color: "#5B7FDB", icon: Briefcase },
  gym: { label: "Gym", color: "#E8556B", icon: Dumbbell },
  health: { label: "Health", color: "#2FA88F", icon: HeartPulse },
  growth: { label: "Growth", color: "#F2790C", icon: BookOpen },
  schedule: { label: "Schedule", color: "#8B7FC7", icon: CalendarClock },
};
export const CATEGORY_ORDER = ["professional", "gym", "health", "growth", "schedule"];

export const TEST_TYPES = ["CT", "IA-1", "IA-2", "Term"];
export const CORRECTION_CODES = ["blank", "done", "ab", "ic", "ns"];
// icon-based marks (safer + crisper than unicode glyphs, which can render as tofu boxes on some devices)
export const CORRECTION_MARKS = { blank: { icon: "minus" }, done: { icon: "check" }, ab: { text: "AB" }, ic: { text: "IC" }, ns: { text: "NS" } };
export const CORRECTION_TITLES = { blank: "Not marked", done: "Done", ab: "Absent", ic: "Incomplete", ns: "Not submitted" };
// starting suggestions for the correction-type dropdown - grows with whatever the user types
export const DEFAULT_CORRECTION_TYPES = ["Classwork", "Homework", "Worksheet", "Textbook", "Revision"];

// per-student, per-concept understanding tag on correction records (classwork/homework)
export const UNDERSTANDING_TAGS = ["blank", "understood", "not-understood", "not-done"];
export const UNDERSTANDING_MARKS = { blank: { icon: "minus" }, understood: { icon: "check" }, "not-understood": { icon: "x" }, "not-done": { text: "ND" } };
export const UNDERSTANDING_TITLES = { blank: "Not marked", understood: "Understood", "not-understood": "Not understood", "not-done": "Not done" };

// per-student, per-concept tag cycled on the performance grid
export const CONCEPT_TAGS = ["blank", "accurate", "application", "silly", "gap"];
export const CONCEPT_MARKS = { blank: { icon: "minus" }, accurate: { icon: "check" }, application: { text: "App" }, silly: { text: "Silly" }, gap: { text: "Gap" } };
export const CONCEPT_TAG_TITLES = {
  blank: "Not marked", accurate: "Accurate", application: "Application gap",
  silly: "Silly mistake", gap: "Concept gap",
};

export const SEED_TASKS = [
  { title: "Morning workout", category: "gym", time: "07:00", duration_min: 45, anchored: true, important: true,
    exercises: [{ name: "Squat", sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 40 }] }] },
  { title: "Lesson prep", category: "professional", time: "08:30", duration_min: 30, anchored: true, important: true },
  { title: "Deep work block", category: "professional", time: "09:30", duration_min: 90, anchored: false, important: true,
    subtasks: ["Draft outline", "First pass", "Review"] },
  { title: "Read 20 min", category: "growth", time: "13:00", duration_min: 20, anchored: false, important: false },
  { title: "Evening walk", category: "health", time: "18:00", duration_min: 30, anchored: false, important: false },
];

export const SEED_CLASSES = [
  { name: "Grade 6 - Mathematics", subject: "Mathematics",
    students: ["Aarav Shah", "Diya Patel", "Kabir Mehta", "Isha Rao", "Vihaan Nair"] },
];
