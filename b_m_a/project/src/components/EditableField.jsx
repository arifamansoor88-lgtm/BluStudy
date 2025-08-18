// src/components/EditableField.jsx
import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function EditableField({
  label,
  value,
  onSave,
  type = "text"
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-semibold">{label}</Label>
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setDraft(value); setEditing(true); }}
          >
            <Pencil className="h-4 w-4"/>
          </Button>
        )}
      </div>
      {editing ? (
        <div className="flex gap-2">
          <Input
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" onClick={() => { onSave(draft); setEditing(false); }}>
            <Check/>
          </Button>
          <Button size="sm" onClick={() => setEditing(false)}>
            <X/>
          </Button>
        </div>
      ) : (
        <p className="p-3 bg-gray-50 rounded">{value || "—"}</p>
      )}
    </div>
  );
}
