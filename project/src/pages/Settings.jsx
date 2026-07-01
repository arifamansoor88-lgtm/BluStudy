import React, { useEffect, useMemo, useState, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import {
  User,
  GraduationCap,
  LogOut,
  Pencil,
  Check,
  X,
  Camera,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useUserProfile } from "../hooks/useUserProfile";

function pickEmail(acct, claims) {
  return (
    claims?.email ||
    claims?.preferred_username ||
    (Array.isArray(claims?.emails) ? claims.emails[0] : undefined) ||
    acct?.username ||
    ""
  );
}
function pickName(acct, claims, fallbackEmail) {
  const givenFamily = [claims?.given_name, claims?.family_name].filter(Boolean).join(" ").trim();
  return (
    claims?.name ||
    givenFamily ||
    acct?.name ||
    (fallbackEmail ? fallbackEmail.split("@")[0] : undefined) ||
    (acct?.username ? acct.username.split("@")[0] : undefined) ||
    "User"
  );
}

const GRADE_OPTIONS = [
  "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10",
  "Grade 11", "Grade 12", "First Year University", "Second Year University",
  "Third Year University", "Fourth Year University", "Graduate",
];

export default function Settings() {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  useEffect(() => {
    if (!accounts?.length) { navigate("/signin"); return; }
    if (!instance.getActiveAccount() && accounts.length) instance.setActiveAccount(accounts[0]);
  }, [instance, accounts, navigate]);

  const account = useMemo(
    () => instance.getActiveAccount() || accounts?.[0] || {},
    [instance, accounts]
  );
  const claims = account?.idTokenClaims || {};
  const userId = account?.localAccountId || claims?.oid || claims?.sub;
  const defaultEmail = useMemo(() => pickEmail(account, claims), [account, claims]);
  const defaultName = useMemo(() => pickName(account, claims, defaultEmail), [account, claims, defaultEmail]);

  const { profile, updateField, loading } = useUserProfile(userId);

  // Local editable state
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [photo, setPhoto] = useState("");

  const [editingName, setEditingName] = useState(false);
  const [editingSchool, setEditingSchool] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingSchool, setSavingSchool] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      setName(profile.name || defaultName);
      setSchool(profile.school || "");
      setGrade(profile.grade || "");
      setPhoto(profile.photo || "");
    }
  }, [loading, profile, defaultName]);

  const initials = (name || defaultName)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // -- handlers --
  const saveName = async () => {
    setSavingName(true);
    await updateField("name", name.trim() || defaultName);
    setSavingName(false);
    setEditingName(false);
  };
  const cancelName = () => { setName(profile.name || defaultName); setEditingName(false); };

  const saveSchool = async () => {
    setSavingSchool(true);
    await Promise.all([updateField("school", school), updateField("grade", grade)]);
    setSavingSchool(false);
    setEditingSchool(false);
  };
  const cancelSchool = () => {
    setSchool(profile.school || "");
    setGrade(profile.grade || "");
    setEditingSchool(false);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      setPhoto(result);
      await updateField("photo", result);
      setPhotoUploading(false);
    };
    reader.onerror = () => setPhotoUploading(false);
    reader.readAsDataURL(file);
  };

  const handleSignOut = async () => {
    await instance.logoutPopup();
    navigate("/signin");
  };

  if (!accounts?.length) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your profile and account</p>
      </div>

      {/* ── Profile card ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-4 w-4 text-primary-600" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Profile</h2>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            {photo ? (
              <img
                src={photo}
                alt="avatar"
                className="h-16 w-16 rounded-full object-cover ring-2 ring-gray-100"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary-600 flex items-center justify-center text-white text-xl font-bold ring-2 ring-gray-100">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photoUploading}
              className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-gray-50 transition-colors"
              title="Change photo"
            >
              {photoUploading ? (
                <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
              ) : (
                <Camera className="h-3 w-3 text-gray-500" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{name || defaultName}</p>
            <p className="text-sm text-gray-400">{defaultEmail}</p>
          </div>
        </div>

        {/* Display name */}
        <Field
          label="Display name"
          editing={editingName}
          onEdit={() => setEditingName(true)}
          onSave={saveName}
          onCancel={cancelName}
          saving={savingName}
        >
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") cancelName(); }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          ) : (
            <p className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded-xl">{name || defaultName}</p>
          )}
        </Field>

        {/* Email — read only from B2C */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
          <p className="text-sm text-gray-400 px-3 py-2 bg-gray-50 rounded-xl">{defaultEmail || "—"}</p>
          <p className="text-xs text-gray-400 mt-1">Email is managed by your sign-in provider.</p>
        </div>
      </section>

      {/* ── Academic card ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary-600" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Academic</h2>
          </div>
          {!editingSchool && (
            <button
              onClick={() => setEditingSchool(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Grade level</label>
            {editingSchool ? (
              <div className="relative">
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full appearance-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white pr-8"
                >
                  <option value="">Select grade</option>
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            ) : (
              <p className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded-xl">{grade || "—"}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">School</label>
            {editingSchool ? (
              <input
                autoFocus
                placeholder="Your school name"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") cancelSchool(); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            ) : (
              <p className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded-xl">{school || "—"}</p>
            )}
          </div>
        </div>

        {editingSchool && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveSchool}
              disabled={savingSchool}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {savingSchool ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </button>
            <button
              onClick={cancelSchool}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* ── Account card ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <LogOut className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Account</h2>
        </div>

        <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
          <div>
            <p className="text-sm font-medium text-gray-800">Sign out</p>
            <p className="text-xs text-gray-400 mt-0.5">You'll be returned to the sign-in page.</p>
          </div>
          {!signOutOpen ? (
            <button
              onClick={() => setSignOutOpen(true)}
              className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              Sign out
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Are you sure?</span>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
              >
                Yes, sign out
              </button>
              <button
                onClick={() => setSignOutOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── About card ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <p className="text-xs text-gray-400 text-center">BluStudy · AI-powered study tools · v1.0</p>
      </section>
    </div>
  );
}

function Field({ label, editing, onEdit, onSave, onCancel, saving, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-500">{label}</label>
        {!editing && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
      {editing && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
