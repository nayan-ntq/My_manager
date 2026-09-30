import React, { useEffect, useState, useCallback } from "react";
import { Plus, X, ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { Segmented } from "./Shared";
import ConfirmDelete from "./ConfirmDelete";
import { toast } from "./Toast";
import * as school from "../lib/school";

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
  const load = useCallback(async () => { setMembers(await school.fetchSchoolMembers(schoolId)); setLoading(false); }, [schoolId]);
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

  if (loading) return <div className="card-sub">Loading...</div>;

  return (
    <div className="card">
      <div className="card-title">Everyone in your school</div>
      {members.length === 0 ? <div className="card-sub">No one yet - share an invite code from the Invites tab.</div> : members.map((m) => (
        <div className="marks-row" key={m.id} style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{m.profiles?.email || "Unknown"}</div>
            <div className="card-sub">{ROLE_LABELS[m.role] || m.role}</div>
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
        ]}
        value={sub} onChange={setSub}
      />
      {sub === "hierarchy" && <HierarchyTab schoolId={schoolId} classes={classes} reloadClasses={reloadClasses} />}
      {sub === "roster" && <RosterTab schoolId={schoolId} divisions={divisions} />}
      {sub === "invites" && <InvitesTab schoolId={schoolId} userId={userId} divisions={divisions} />}
    </div>
  );
}
