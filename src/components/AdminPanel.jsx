import React, { useEffect, useState, useCallback } from "react";
import { Plus, X, ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { Segmented } from "./Shared";
import ConfirmDelete from "./ConfirmDelete";
import { toast } from "./Toast";
import * as school from "../lib/school";
import * as db from "../lib/db";
import { computeWorkingDays, WEEKDAY_LABELS } from "../lib/terms";
import PhotoImportButton from "./PhotoImportButton";
import CsvReviewSheet from "./CsvReviewSheet";

/* ---------- terms + holidays (admin sets dates, everyone can see working days) ---------- */

function TermEditSheet({ term, onClose, onSave, onDelete }) {
  const [name, setName] = useState(term?.name || "");
  const [startDate, setStartDate] = useState(term?.start_date || "");
  const [endDate, setEndDate] = useState(term?.end_date || "");
  const [offDays, setOffDays] = useState(term?.weekly_off_days || [0]);
  const toggleDay = (d) => setOffDays(offDays.includes(d) ? offDays.filter((x) => x !== d) : [...offDays, d].sort());

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">{term ? "Edit term" : "New term"}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="field-label">Term name</div>
        <input className="input" placeholder="e.g. Term 1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="row-2">
          <div><div className="field-label">Start date</div><input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><div className="field-label">End date</div><input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>
        <div className="field-label">Weekly off days</div>
        <div className="cat-select">
          {WEEKDAY_LABELS.map((label, i) => (
            <button type="button" key={label} className={`cat-opt ${offDays.includes(i) ? "active" : ""}`} style={{ color: offDays.includes(i) ? "#F2790C" : undefined }} onClick={() => toggleDay(i)}>{label}</button>
          ))}
        </div>
        <div className="sheet-actions">
          {term && <ConfirmDelete onConfirm={() => { onDelete(); onClose(); }} size={14} />}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => name.trim() && startDate && endDate && onSave({ name: name.trim(), start_date: startDate, end_date: endDate, weekly_off_days: offDays })}>Save</button>
        </div>
      </div>
    </div>
  );
}

function TermsTab({ schoolId, canEdit }) {
  const [terms, setTerms] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [editingTerm, setEditingTerm] = useState(null); // term object, or "new"
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayLabel, setHolidayLabel] = useState("");
  const [holidayCsvImport, setHolidayCsvImport] = useState(null); // csv string
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, h] = await Promise.all([db.fetchTerms(schoolId), db.fetchHolidays(schoolId)]);
    setTerms(t); setHolidays(h); setLoading(false);
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  const saveTerm = async (form) => {
    if (editingTerm && editingTerm !== "new") await db.updateTerm(editingTerm.id, form);
    else await db.createTerm(schoolId, form);
    setEditingTerm(null); load();
    toast("Term saved");
  };
  const deleteTerm = async (id) => { await db.deleteTerm(id); load(); toast("Term deleted"); };
  const addHoliday = async () => {
    if (!holidayDate) return;
    await db.createHoliday(schoolId, holidayDate, holidayLabel.trim());
    setHolidayDate(""); setHolidayLabel(""); load();
    toast("Holiday added");
  };
  const removeHoliday = async (id) => { await db.deleteHoliday(id); load(); toast("Holiday removed"); };
  const importHolidays = async (rows) => {
    const count = await db.bulkCreateHolidays(schoolId, rows);
    setHolidayCsvImport(null); load();
    toast(`Imported ${count} holiday${count === 1 ? "" : "s"}`);
  };

  if (loading) return <div className="card-sub">Loading...</div>;

  return (
    <div>
      <div className="card">
        <div className="card-title-row">
          <div className="card-title" style={{ marginBottom: 0 }}>Terms</div>
          {canEdit && <button type="button" className="chip-btn" onClick={() => setEditingTerm("new")}><Plus size={12} /> Add term</button>}
        </div>
        {terms.length === 0 ? <div className="card-sub">No terms set yet.</div> : terms.map((t) => {
          const inRangeHolidays = holidays.filter((h) => h.date >= t.start_date && h.date <= t.end_date).map((h) => h.date);
          const workingDays = computeWorkingDays(t, inRangeHolidays);
          return (
            <div className="marks-row" key={t.id}>
              <div style={{ cursor: canEdit ? "pointer" : "default" }} onClick={() => canEdit && setEditingTerm(t)}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.name}</div>
                <div className="card-sub mono">{t.start_date} to {t.end_date}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#F2790C" }}>{workingDays}</div>
                <div className="card-sub">working days</div>
              </div>
            </div>
          );
        })}
      </div>
      {canEdit && (
        <div className="card">
          <div className="card-title-row">
            <div className="card-title" style={{ marginBottom: 0 }}>Holidays (excluded from every term's count)</div>
            <PhotoImportButton kind="holidays" context={{ calendarYearHint: new Date().getFullYear() }} onResult={({ csv }) => setHolidayCsvImport(csv)} label="Import from calendar" />
          </div>
          <div className="row-2">
            <input type="date" className="input" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
            <input className="input" placeholder="Label (optional)" value={holidayLabel} onChange={(e) => setHolidayLabel(e.target.value)} />
          </div>
          <button type="button" className="chip-btn" style={{ marginTop: 8 }} onClick={addHoliday}><Plus size={12} /> Add holiday</button>
          {holidays.length > 0 && holidays.map((h) => (
            <div className="marks-row" key={h.id}>
              <span className="mono">{h.date} {h.label ? `- ${h.label}` : ""}</span>
              <ConfirmDelete onConfirm={() => removeHoliday(h.id)} size={13} />
            </div>
          ))}
        </div>
      )}
      {editingTerm && (
        <TermEditSheet
          term={editingTerm === "new" ? null : editingTerm}
          onClose={() => setEditingTerm(null)}
          onSave={saveTerm}
          onDelete={() => deleteTerm(editingTerm.id)}
        />
      )}
      {holidayCsvImport && (
        <CsvReviewSheet
          title="Import holidays"
          csv={holidayCsvImport}
          columns={["date", "label"]}
          onClose={() => setHolidayCsvImport(null)}
          onConfirm={importHolidays}
        />
      )}
    </div>
  );
}

const ROLE_LABELS = { teacher: "Teacher", coordinator: "Coordinator", school_admin: "Admin", super_admin: "Super admin" };

/* ---------- hierarchy tree ---------- */

function DivisionNode({ node, childrenOf, depth, classes, onAddChild, onRename, onDelete, onAssignClass }) {
  const [adding, setAdding] = useState(false);
  const [childName, setChildName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(node.name);
  const [expanded, setExpanded] = useState(true);
  const kids = childrenOf[node.id] || [];
  const classesHere = classes.filter((c) => c.division_id === node.id);

  const submitChild = () => {
    if (!childName.trim()) return;
    onAddChild(node.id, childName.trim());
    setChildName(""); setAdding(false);
  };
  const submitRename = () => {
    if (!name.trim()) return;
    onRename(node.id, name.trim());
    setRenaming(false);
  };

  return (
    <div style={{ marginLeft: depth ? 16 : 0 }}>
      <div className="category-row">
        {(kids.length > 0 || classesHere.length > 0) && (
          <button type="button" className="btn btn-icon" style={{ padding: "4px 6px" }} onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        )}
        {renaming ? (
          <input className="input" style={{ padding: "6px 8px" }} value={name} autoFocus
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitRename()} onBlur={submitRename} />
        ) : (
          <span className="category-row-label" style={{ cursor: "pointer" }} onClick={() => setRenaming(true)}>{node.name}</span>
        )}
        <button type="button" className="chip-btn" onClick={() => setAdding(!adding)}><Plus size={12} /> Add under</button>
        <ConfirmDelete onConfirm={() => onDelete(node.id)} size={13} />
      </div>
      {adding && (
        <div className="row-2" style={{ marginLeft: 16, marginBottom: 8 }}>
          <input className="input" placeholder="e.g. Grade 6, or Mathematics" value={childName} autoFocus
            onChange={(e) => setChildName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitChild()} />
          <button type="button" className="btn btn-ghost" onClick={submitChild}>Add</button>
        </div>
      )}
      {expanded && classesHere.length > 0 && (
        <div style={{ marginLeft: 16 + 16, marginBottom: 4 }}>
          {classesHere.map((c) => (
            <div key={c.id} className="card-sub" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
              {c.name}
              <button type="button" className="chip-btn" style={{ padding: "3px 8px", fontSize: 10.5 }} onClick={() => onAssignClass(c.id, null)}>Unassign</button>
            </div>
          ))}
        </div>
      )}
      {expanded && kids.map((child) => (
        <DivisionNode key={child.id} node={child} childrenOf={childrenOf} depth={depth + 1}
          classes={classes} onAddChild={onAddChild} onRename={onRename} onDelete={onDelete} onAssignClass={onAssignClass} />
      ))}
    </div>
  );
}

function HierarchyTab({ schoolId, classes, reloadClasses }) {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rootName, setRootName] = useState("");
  const [assignClassId, setAssignClassId] = useState("");
  const [assignDivisionId, setAssignDivisionId] = useState("");

  const load = useCallback(async () => { setDivisions(await school.fetchDivisions(schoolId)); setLoading(false); }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  const childrenOf = {};
  for (const d of divisions) { (childrenOf[d.parent_id || "root"] = childrenOf[d.parent_id || "root"] || []).push(d); }
  const roots = childrenOf.root || [];

  const addChild = async (parentId, name) => {
    await school.createDivision(schoolId, parentId, name, divisions.length);
    load();
    toast("Added");
  };
  const addRoot = async () => {
    if (!rootName.trim()) return;
    await school.createDivision(schoolId, null, rootName.trim(), divisions.length);
    setRootName("");
    load();
    toast("Added");
  };
  const rename = async (id, name) => { await school.renameDivision(id, name); load(); };
  const remove = async (id) => { await school.deleteDivision(id); load(); toast("Removed"); };
  const assignClass = async (classId, divisionId) => {
    await school.setClassDivision(classId, divisionId);
    reloadClasses();
    toast(divisionId ? "Class assigned" : "Class unassigned");
  };

  // flat, indented list of every division for the assign-class picker
  const flatOptions = [];
  const walk = (parentId, depth) => {
    for (const d of childrenOf[parentId || "root"] || []) {
      flatOptions.push({ id: d.id, label: `${"-- ".repeat(depth)}${d.name}` });
      walk(d.id, depth + 1);
    }
  };
  walk(null, 0);

  if (loading) return <div className="card-sub">Loading...</div>;

  return (
    <div>
      <div className="card">
        <div className="card-title">Your school's structure</div>
        <div className="card-sub" style={{ marginBottom: 10, lineHeight: 1.5 }}>
          Build it however your school actually works - e.g. Lower Secondary, then Math / Bio / English under it, then class and section. Add as many levels as you need.
        </div>
        {roots.length === 0 && <div className="card-sub" style={{ marginBottom: 8 }}>Nothing set up yet - add your first top-level group below.</div>}
        {roots.map((node) => (
          <DivisionNode key={node.id} node={node} childrenOf={childrenOf} depth={0}
            classes={classes} onAddChild={addChild} onRename={rename} onDelete={remove} onAssignClass={assignClass} />
        ))}
        <div className="row-2" style={{ marginTop: 10 }}>
          <input className="input" placeholder="e.g. Lower Secondary" value={rootName} onChange={(e) => setRootName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoot()} />
          <button type="button" className="btn btn-ghost" onClick={addRoot}><Plus size={14} /> Add top-level group</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Assign a class to a spot in the structure</div>
        <div className="row-2">
          <select className="input" value={assignClassId} onChange={(e) => setAssignClassId(e.target.value)}>
            <option value="">Choose a class...</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={assignDivisionId} onChange={(e) => setAssignDivisionId(e.target.value)}>
            <option value="">Choose where it goes...</option>
            {flatOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-primary" style={{ marginTop: 10 }}
          disabled={!assignClassId || !assignDivisionId}
          onClick={() => { assignClass(assignClassId, assignDivisionId); setAssignClassId(""); setAssignDivisionId(""); }}>
          Assign
        </button>
      </div>
    </div>
  );
}

/* ---------- roster ---------- */

function RosterTab({ schoolId, divisions }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editingNameFor, setEditingNameFor] = useState(null); // user_id
  const [nameInput, setNameInput] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try { setMembers(await school.fetchSchoolMembers(schoolId)); }
    catch (err) { setLoadError(err.message || "Couldn't load the people list"); }
    finally { setLoading(false); }
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  const changeRole = async (m, role) => {
    await school.updateMemberRole(m.id, role, role === "coordinator" ? m.division_id : null);
    load();
    toast("Updated");
  };
  const changeDivision = async (m, divisionId) => {
    await school.updateMemberRole(m.id, m.role, divisionId);
    load();
    toast("Updated");
  };
  const remove = async (m) => { await school.removeMember(m.id); load(); toast("Removed from school"); };
  const startEditName = (m) => { setEditingNameFor(m.user_id); setNameInput(m.profiles?.full_name || ""); };
  const saveName = async (m) => {
    await school.updateProfileName(m.user_id, nameInput);
    setEditingNameFor(null); load();
    toast("Name updated");
  };

  if (loading) return <div className="card-sub">Loading...</div>;
  if (loadError) return <div className="card"><div className="auth-error">{loadError}</div><button type="button" className="chip-btn" style={{ marginTop: 10 }} onClick={load}>Try again</button></div>;

  return (
    <div className="card">
      <div className="card-title">Everyone in your school</div>
      {members.length === 0 ? <div className="card-sub">No one yet - share an invite code from the Invites tab.</div> : members.map((m) => (
        <div className="marks-row" key={m.id} style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            {editingNameFor === m.user_id ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input className="input" style={{ padding: "6px 8px", fontSize: 13 }} placeholder={m.profiles?.email} value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && saveName(m)} />
                <button type="button" className="btn btn-icon" onClick={() => saveName(m)}><Check size={13} /></button>
                <button type="button" className="btn btn-icon" onClick={() => setEditingNameFor(null)}><X size={13} /></button>
              </div>
            ) : (
              <div style={{ fontWeight: 700, fontSize: 13.5, cursor: "pointer" }} onClick={() => startEditName(m)}>
                {m.profiles?.full_name || m.profiles?.email || "Unknown"}
                {m.profiles?.full_name && <span className="card-sub" style={{ fontWeight: 500 }}> ({m.profiles.email})</span>}
              </div>
            )}
            <div className="card-sub">{ROLE_LABELS[m.role] || m.role}{m.profiles?.subjects_taught ? ` - teaches ${m.profiles.subjects_taught}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <select className="input" style={{ padding: "6px 8px", fontSize: 12.5, width: "auto" }} value={m.role} onChange={(e) => changeRole(m, e.target.value)}>
              <option value="teacher">Teacher</option>
              <option value="coordinator">Coordinator</option>
              <option value="school_admin">Admin</option>
            </select>
            {m.role === "coordinator" && (
              <select className="input" style={{ padding: "6px 8px", fontSize: 12.5, width: "auto" }} value={m.division_id || ""} onChange={(e) => changeDivision(m, e.target.value || null)}>
                <option value="">Whole school</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            <ConfirmDelete onConfirm={() => remove(m)} size={13} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- invites ---------- */

function InvitesTab({ schoolId, userId, divisions }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("teacher");
  const [divisionId, setDivisionId] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const load = useCallback(async () => { setInvites(await school.fetchInvites(schoolId)); setLoading(false); }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    await school.createInvite(schoolId, userId, role, role === "coordinator" ? divisionId || null : null);
    load();
    toast("Invite code created");
  };
  const remove = async (id) => { await school.deleteInvite(id); load(); toast("Invite removed"); };
  const copy = (invite) => {
    navigator.clipboard?.writeText(invite.code).catch(() => {});
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (loading) return <div className="card-sub">Loading...</div>;

  return (
    <div>
      <div className="card">
        <div className="card-title">Invite someone</div>
        <div className="card-sub" style={{ marginBottom: 10 }}>They'll enter this code when they sign up or in Settings.</div>
        <div className="row-2">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="teacher">Teacher</option>
            <option value="coordinator">Coordinator</option>
            <option value="school_admin">Admin</option>
          </select>
          {role === "coordinator" && (
            <select className="input" value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
              <option value="">Whole school</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>
        <button type="button" className="btn btn-primary" style={{ marginTop: 10 }} onClick={create}><Plus size={14} /> Create invite code</button>
      </div>
      <div className="card">
        <div className="card-title">Active codes</div>
        {invites.length === 0 ? <div className="card-sub">None yet.</div> : invites.map((inv) => (
          <div className="marks-row" key={inv.id}>
            <div>
              <div className="mono" style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.06em" }}>{inv.code}</div>
              <div className="card-sub">{ROLE_LABELS[inv.role] || inv.role}{inv.divisions?.name ? ` - ${inv.divisions.name}` : ""} - {inv.uses}/{inv.max_uses} used</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn btn-icon" onClick={() => copy(inv)} title="Copy code">{copiedId === inv.id ? <Check size={13} /> : <Copy size={13} />}</button>
              <ConfirmDelete onConfirm={() => remove(inv.id)} size={13} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- shell ---------- */

export default function AdminPanel({ userId, schoolId, classes, reloadClasses }) {
  const [sub, setSub] = useState("hierarchy");
  const [divisions, setDivisions] = useState([]);
  useEffect(() => { school.fetchDivisions(schoolId).then(setDivisions); }, [schoolId, sub]);

  return (
    <div>
      <Segmented
        options={[
          { value: "hierarchy", label: "Structure" },
          { value: "roster", label: "People" },
          { value: "invites", label: "Invites" },
          { value: "terms", label: "Terms" },
        ]}
        value={sub} onChange={setSub}
      />
      {sub === "hierarchy" && <HierarchyTab schoolId={schoolId} classes={classes} reloadClasses={reloadClasses} />}
      {sub === "roster" && <RosterTab schoolId={schoolId} divisions={divisions} />}
      {sub === "invites" && <InvitesTab schoolId={schoolId} userId={userId} divisions={divisions} />}
      {sub === "terms" && <TermsTab schoolId={schoolId} canEdit={true} />}
    </div>
  );
}
