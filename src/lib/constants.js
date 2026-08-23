import { Dumbbell, HeartPulse, BookOpen, Briefcase, CalendarClock, GraduationCap, Coffee, Music, Palette, Star, Target, Plane, Home as HomeIcon, ShoppingCart } from "lucide-react";

// icon-key registry so user-defined categories (stored as a plain string in the
// database) can still render a real icon. Add more here any time.
export const ICON_REGISTRY = {
  briefcase: Briefcase, dumbbell: Dumbbell, "heart-pulse": HeartPulse, "book-open": BookOpen,
  "calendar-clock": CalendarClock, "graduation-cap": GraduationCap, coffee: Coffee, music: Music,
  palette: Palette, star: Star, target: Target, plane: Plane, home: HomeIcon, cart: ShoppingCart,
};
export const ICON_KEYS = Object.keys(ICON_REGISTRY);
export const CATEGORY_COLOR_CHOICES = ["#5B7FDB", "#E8556B", "#2FA88F", "#F2790C", "#8B7FC7", "#D9A441", "#4FB3C4", "#C4577A"];

// Fallback only \u2014 real categories now come from the task_categories table (per user, editable).
export const DEFAULT_CATEGORY_SEED = [
  { key: "professional", label: "Professional", color: "#5B7FDB", icon_key: "briefcase" },
  { key: "gym", label: "Gym", color: "#E8556B", icon_key: "dumbbell" },
  { key: "health", label: "Health", color: "#2FA88F", icon_key: "heart-pulse" },
  { key: "growth", label: "Growth", color: "#F2790C", icon_key: "book-open" },
  { key: "schedule", label: "Schedule", color: "#8B7FC7", icon_key: "calendar-clock" },
];

export const DEFAULT_TEST_TYPES = ["CT", "IA-1", "IA-2", "Term"];
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
