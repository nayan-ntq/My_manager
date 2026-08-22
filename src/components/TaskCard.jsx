import React, { useState } from "react";
import { Clock, Lock, Star, ChevronRight, ChevronDown, Check, SkipForward } from "lucide-react";
import ConfirmDelete from "./ConfirmDelete";
import { CATEGORIES } from "../lib/constants";
import PhotoStrip from "./PhotoStrip";

function fmtTime(d) { return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

export default function TaskCard({
  task, popup, onComplete, onSkip, onReset, onEdit, onDelete,
  onToggleSub, onToggleSet, onAddExercisePhoto, onRemoveExercisePhoto,
}) {
  const cat = CATEGORIES[task.category]; const Icon = cat.icon;
  const isDone = task.status === "done", isSkipped = task.status === "skipped";
  const [expanded, setExpanded] = useState(false);
  const hasSub = (task.subtasks || []).length > 0;
  const hasGym = task.category === "gym" && (task.exercises || []).length > 0;
  const doneSub = (task.subtasks || []).filter((s) => s.done).length;

  return (
    <div className={`task-card ${isDone ? "done" : ""} ${task.overdue ? "overdue" : ""}`}>
      <div className={`task-node ${task.overdue && !isDone && !isSkipped ? "pulse" : ""}`} style={{ background: isDone ? "#2FA88F" : isSkipped ? "#c9c2b6" : task.overdue ? "#E8556B" : cat.color }} />
      {popup && <div className="points-popup">+{popup}</div>}
      <div className="task-top">
        <div className="task-time"><Clock size={12} />{fmtTime(task.effectiveStart)}{task.anchored && <Lock size={11} style={{ marginLeft: 2, opacity: 0.6 }} />}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-icon" onClick={() => onEdit(task)}><ChevronRight size={14} /></button>
          <ConfirmDelete onConfirm={() => onDelete(task.id)} size={14} />
        </div>
      </div>
      <div className="task-title-row">{task.important && <Star size={13} color="#F2790C" fill="#F2790C" />}<span className={`task-title ${isDone || isSkipped ? "strike" : ""}`}>{task.title}</span></div>
      <div className="task-meta">
        <span className="cat-chip" style={{ color: cat.color, background: `${cat.color}17` }}><Icon size={12} /> {cat.label}</span>
        <span>{task.duration} min</span>
        {task.delayMin > 1 && !isDone && <span className="badge-delay">shifted +{task.delayMin}m</span>}
        {task.conflict && <span className="badge-delay">tight schedule</span>}
        {hasSub && <span>{doneSub}/{task.subtasks.length} steps</span>}
        {isDone && <span style={{ color: "#2FA88F" }}>done</span>}
        {isSkipped && <span>skipped</span>}
      </div>
      {(hasSub || hasGym) && <button className="expand-toggle" onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{hasGym ? "Workout log" : "Steps"}</button>}
      {expanded && hasSub && (
        <div className="subtask-list">
          {task.subtasks.map((s, i) => (
            <label key={s.id || i} className={`subtask-row ${s.done ? "done" : ""}`}>
              <input type="checkbox" checked={s.done} onChange={() => onToggleSub(s)} /><span>{s.title}</span>
            </label>
          ))}
        </div>
      )}
      {expanded && hasGym && (
        <div className="workout-logger">
          {task.exercises.map((ex, ei) => (
            <div className="exercise-block" key={ex.id || ei}>
              <div className="exercise-head"><span className="exercise-name-static">{ex.name || "Exercise"}</span></div>
              <div className="set-rows">
                <div className="set-row set-row-header"><span>Set</span><span>Reps</span><span>Weight</span><span /></div>
                {ex.sets.map((s, si) => (
                  <div className={`set-row ${s.done ? "set-done" : ""}`} key={s.id || si}>
                    <span className="set-num">{si + 1}</span><span className="set-static">{s.reps || " - "}</span><span className="set-static">{s.weight || " - "} kg</span>
                    <button className={`btn btn-icon set-check ${s.done ? "on" : ""}`} onClick={() => onToggleSet(s)}><Check size={12} /></button>
                  </div>
                ))}
              </div>
              <div className="field-label" style={{ margin: "10px 0 6px" }}>Photos</div>
              <PhotoStrip
                photos={ex.photos || []}
                onAdd={(url) => onAddExercisePhoto(ex)(url)}
                onRemove={(pi) => onRemoveExercisePhoto(ex)(pi)}
              />
            </div>
          ))}
        </div>
      )}
      {!isDone && !isSkipped && (
        <div className="task-actions">
          <button className="btn btn-done" onClick={() => onComplete(task)}><Check size={13} /> Done</button>
          <button className="btn btn-skip" onClick={() => onSkip(task)}><SkipForward size={13} /> Skip</button>
        </div>
      )}
      {(isDone || isSkipped) && <div className="task-actions"><button className="btn btn-skip" onClick={() => onReset(task)}>Undo</button></div>}
    </div>
  );
}
