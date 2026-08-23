import React, { useState } from "react";
import { X, Plus, Check } from "lucide-react";
import { ICON_REGISTRY, ICON_KEYS, CATEGORY_COLOR_CHOICES } from "../lib/constants";
import ConfirmDelete from "./ConfirmDelete";
import { toast } from "./Toast";
import * as db from "../lib/db";

function slugify(label) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `cat-${Date.now()}`;
}

export default function CategoryManager({ userId, categories, onClose, onChanged }) {
  const [editing, setEditing] = useState(null); // category id being edited, or "new"
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(CATEGORY_COLOR_CHOICES[0]);
  const [iconKey, setIconKey] = useState(ICON_KEYS[0]);

  const startNew = () => { setEditing("new"); setLabel(""); setColor(CATEGORY_COLOR_CHOICES[0]); setIconKey(ICON_KEYS[0]); };
  const startEdit = (c) => { setEditing(c.id); setLabel(c.label); setColor(c.color); setIconKey(c.icon_key); };

  const save = async () => {
    if (!label.trim()) return;
    if (editing === "new") {
      const key = slugify(label);
      await db.createCategory(userId, key, label.trim(), color, iconKey, categories.length);
      toast("Category added");
    } else {
      await db.updateCategory(editing, { label: label.trim(), color, icon_key: iconKey });
      toast("Category updated");
    }
    setEditing(null);
    onChanged();
  };
  const remove = async (id) => {
    await db.deleteCategory(id);
    toast("Category deleted");
    onChanged();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Categories</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {categories.map((c) => {
          const Icon = ICON_REGISTRY[c.icon_key] || ICON_REGISTRY.star;
          const isEditing = editing === c.id;
          return (
            <div className="category-row" key={c.id}>
              {!isEditing ? (
                <>
                  <span className="category-row-badge" style={{ color: c.color, background: `${c.color}17` }}><Icon size={14} /></span>
                  <span className="category-row-label">{c.label}</span>
                  <button type="button" className="chip-btn" onClick={() => startEdit(c)}>Edit</button>
                  <ConfirmDelete onConfirm={() => remove(c.id)} />
                </>
              ) : (
                <CategoryEditForm label={label} setLabel={setLabel} color={color} setColor={setColor} iconKey={iconKey} setIconKey={setIconKey} onSave={save} onCancel={() => setEditing(null)} />
              )}
            </div>
          );
        })}

        {editing === "new" ? (
          <div className="category-row category-row-new">
            <CategoryEditForm label={label} setLabel={setLabel} color={color} setColor={setColor} iconKey={iconKey} setIconKey={setIconKey} onSave={save} onCancel={() => setEditing(null)} />
          </div>
        ) : (
          <button type="button" className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={startNew}><Plus size={14} /> Add category</button>
        )}
      </div>
    </div>
  );
}

function CategoryEditForm({ label, setLabel, color, setColor, iconKey, setIconKey, onSave, onCancel }) {
  return (
    <div style={{ width: "100%" }}>
      <input className="input" placeholder="Category name" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
      <div className="field-label">Color</div>
      <div className="color-swatches">
        {CATEGORY_COLOR_CHOICES.map((c) => (
          <button type="button" key={c} className={`color-swatch ${color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setColor(c)}>
            {color === c && <Check size={12} color="#fff" />}
          </button>
        ))}
      </div>
      <div className="field-label">Icon</div>
      <div className="icon-swatches">
        {ICON_KEYS.map((key) => {
          const Icon = ICON_REGISTRY[key];
          return (
            <button type="button" key={key} className={`icon-swatch ${iconKey === key ? "selected" : ""}`} onClick={() => setIconKey(key)}>
              <Icon size={16} />
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={onSave}>Save</button>
      </div>
    </div>
  );
}
