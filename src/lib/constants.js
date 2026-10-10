export const DEFAULT_TEST_TYPES = [
  { name: "CT", passingMarks: null }, { name: "IA-1", passingMarks: null },
  { name: "IA-2", passingMarks: null }, { name: "Term", passingMarks: null },
];

// medium a classwork/homework item was done in - purely descriptive, shown as a small tag
export const MEDIUM_OPTIONS = [
  { value: "folder", label: "Folder" },
  { value: "book", label: "Book" },
  { value: "notebook", label: "Notebook" },
];
export const CORRECTION_CODES = ["blank", "done", "ab", "ic", "ns"];
// icon-based marks (safer + crisper than unicode glyphs, which can render as tofu boxes on some devices)
export const CORRECTION_MARKS = { blank: { icon: "minus" }, done: { icon: "check" }, ab: { text: "AB" }, ic: { text: "IC" }, ns: { text: "NS" } };
export const CORRECTION_TITLES = { blank: "Not marked", done: "Done", ab: "Absent", ic: "Incomplete", ns: "Not submitted" };
// starting suggestions for the correction-type dropdown - grows with whatever the user types
export const DEFAULT_CORRECTION_TYPES = ["Classwork", "Homework", "Worksheet", "Textbook", "Revision"];

// per-student, per-concept understanding tag on correction records (classwork/homework)
// per-student, per-concept status on correction records (classwork/homework).
// "next_date" and "remark" need an extra value alongside the status itself.
export const CORRECTION_CONCEPT_STATUSES = ["blank", "done", "not_submitted", "absent", "incomplete", "next_date", "remark"];
export const CORRECTION_CONCEPT_MARKS = {
  blank: { icon: "minus" }, done: { icon: "check" }, not_submitted: { text: "NS" },
  absent: { text: "AB" }, incomplete: { text: "IC" }, next_date: { icon: "calendar-clock" }, remark: { text: "..." },
};
export const CORRECTION_CONCEPT_TITLES = {
  blank: "Not marked", done: "Done", not_submitted: "Not submitted", absent: "Absent",
  incomplete: "Incomplete", next_date: "Extended to a new date", remark: "Remark",
};
export const CORRECTION_CONCEPT_NEEDS_VALUE = { next_date: "date", remark: "text" };

// per-student, per-concept quality tag on HOMEWORK correction records only (classwork
// correction just has the completion status above). Defaults to "accurate" once a
// concept is marked done - the teacher only touches students who had a problem.
export const HOMEWORK_QUALITY_TAGS = ["accurate", "silly_mistake", "concept_gap", "application_gap"];
export const HOMEWORK_QUALITY_TITLES = {
  accurate: "Accurate", silly_mistake: "Silly Mistake", concept_gap: "Concept Gap", application_gap: "Application Gap",
};

// per-student, per-concept tag cycled on the performance grid
export const CONCEPT_TAGS = ["blank", "accurate", "application", "silly", "gap"];
export const CONCEPT_MARKS = { blank: { icon: "minus" }, accurate: { icon: "check" }, application: { text: "App" }, silly: { text: "Silly" }, gap: { text: "Gap" } };
export const CONCEPT_TAG_TITLES = {
  blank: "Not marked", accurate: "Accurate", application: "Application gap",
  silly: "Silly mistake", gap: "Concept gap",
};

export const SEED_CLASSES = [
  { name: "Grade 6 - Mathematics", subject: "Mathematics",
    students: ["Aarav Shah", "Diya Patel", "Kabir Mehta", "Isha Rao", "Vihaan Nair"] },
];
