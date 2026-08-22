import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Plus, CalendarClock } from "lucide-react";
import TaskCard from "../components/TaskCard";
import AddTaskSheet from "../components/AddTaskSheet";
import { DateStrip } from "../components/Shared";
import Spinner from "../components/Spinner";
import { toast } from "../components/Toast";
import { computeSchedule } from "../lib/schedule";
import * as db from "../lib/db";

function todayKey() { return new Date().toISOString().slice(0, 10); }

export default function Today({ userId, stats, onStatsChange, now }) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [popup, setPopup] = useState(null);
  const isToday = selectedDate === todayKey();

  const load = useCallback(async () => {
    setLoading(true);
    try { setTasks(await db.fetchTasksForDate(userId, selectedDate)); }
    finally { setLoading(false); }
  }, [userId, selectedDate]);

  useEffect(() => { load(); }, [load]);

  const schedule = useMemo(() => computeSchedule(tasks, now, isToday), [tasks, now, isToday]);
  const sorted = useMemo(() => [...schedule].sort((a, b) => a.effectiveStart - b.effectiveStart), [schedule]);

  const level = Math.floor(stats.points / 100) + 1;
  const levelProgress = stats.points % 100;

  const completeTask = async (task) => {
    const actualStart = new Date().toISOString();
    await db.setTaskStatus(task.id, "done", actualStart);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: "done", actual_start: actualStart } : t));

    const pts = task.important ? 15 : 8;
    let streak = stats.streak;
    const today = todayKey();
    if (task.important && isToday) {
      if (stats.last_active_day === today) {}
      else if (stats.last_active_day && new Date(today) - new Date(stats.last_active_day) === 86400000) streak = stats.streak + 1;
      else streak = 1;
    }
    onStatsChange({
      points: stats.points + pts, streak,
      longest_streak: Math.max(stats.longest_streak || 0, streak),
      last_active_day: task.important && isToday ? today : stats.last_active_day,
    });
    setPopup({ id: task.id, points: pts });
    setTimeout(() => setPopup(null), 1100);
  };

  const skipTask = async (task) => { await db.setTaskStatus(task.id, "skipped"); setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: "skipped" } : t)); };
  const resetTask = async (task) => { await db.setTaskStatus(task.id, "pending", null); setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: "pending", actual_start: null } : t)); };
  const deleteTaskRow = async (id) => { await db.deleteTask(id); setTasks((prev) => prev.filter((t) => t.id !== id)); toast("Task deleted"); };
  const toggleSub = async (sub) => { await db.toggleSubtask(sub.id, !sub.done); setTasks((prev) => prev.map((t) => ({ ...t, subtasks: t.subtasks.map((s) => s.id === sub.id ? { ...s, done: !s.done } : s) }))); };
  const toggleSet = async (set) => { await db.updateSet(set.id, { done: !set.done }); setTasks((prev) => prev.map((t) => ({ ...t, exercises: t.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => s.id === set.id ? { ...s, done: !s.done } : s) })) }))); };

  const addExercisePhoto = (ex) => async (dataUrl) => {
    const photos = await db.addExercisePhoto(ex.id, ex.photos, dataUrl);
    setTasks((prev) => prev.map((t) => ({ ...t, exercises: t.exercises.map((e) => e.id === ex.id ? { ...e, photos } : e) })));
  };
  const removeExercisePhoto = (ex) => async (idx) => {
    const photos = await db.removeExercisePhoto(ex.id, ex.photos, idx);
    setTasks((prev) => prev.map((t) => ({ ...t, exercises: t.exercises.map((e) => e.id === ex.id ? { ...e, photos } : e) })));
  };

  const openAdd = () => { setEditingTask(null); setShowForm(true); };
  const openEdit = (task) => { setEditingTask(task); setShowForm(true); };
  const submitForm = async (form) => {
    if (editingTask) {
      await db.updateTaskCore(editingTask.id, { title: form.title, category: form.category, time: form.time, duration: Number(form.duration), anchored: form.anchored, important: form.important });
    } else {
      await db.createTask(userId, selectedDate, form);
    }
    setShowForm(false);
    await load();
    toast(editingTask ? "Task updated" : "Task added");
  };

  return (
    <div className="page">
      <DateStrip selectedDate={selectedDate} onChange={setSelectedDate} />
      <div className="card">
        <div className="level-top"><span>Level {level}</span><span className="mono">{levelProgress}/100</span></div>
        <div className="level-track"><div className="level-fill" style={{ width: `${levelProgress}%` }} /></div>
      </div>
      {loading ? (
        <Spinner label="Loading your day..." />
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CalendarClock size={22} /></div>
          <div className="empty-state-text">Nothing scheduled for this day yet. Tap the + button to add your first task.</div>
        </div>
      ) : (
        <div className="timeline">
          {sorted.map((t) => (
            <TaskCard key={t.id} task={t} popup={popup && popup.id === t.id ? popup.points : null}
              onComplete={completeTask} onSkip={skipTask} onReset={resetTask} onEdit={openEdit}
              onDelete={deleteTaskRow} onToggleSub={toggleSub} onToggleSet={toggleSet}
              onAddExercisePhoto={addExercisePhoto} onRemoveExercisePhoto={removeExercisePhoto} />
          ))}
        </div>
      )}
      <button className="fab" onClick={openAdd}><Plus size={24} /></button>
      {showForm && <AddTaskSheet editingTask={editingTask} onClose={() => setShowForm(false)} onSubmit={submitForm} onDelete={deleteTaskRow} />}
    </div>
  );
}
