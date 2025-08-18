// src/pages/Profile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { b2cPolicies } from "../authConfig";
import { useNavigate } from "react-router-dom";
import { User, Camera, Key, Pencil, Check, X, GraduationCap } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useUserProfile } from "../hooks/useUserProfile";

// ---------- helpers to extract identity ----------
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
    (givenFamily || undefined) ||
    acct?.name ||
    (fallbackEmail ? fallbackEmail.split("@")[0] : undefined) ||
    (acct?.username ? acct.username.split("@")[0] : undefined) ||
    "User"
  );
}

export default function Profile() {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  // ensure an active account or send to sign-in
  useEffect(() => {
    if (!accounts?.length) {
      navigate("/signin");
      return;
    }
    if (!instance.getActiveAccount() && accounts?.length) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [instance, accounts, navigate]);

  const account = useMemo(
    () => instance.getActiveAccount() || accounts?.[0] || {},
    [instance, accounts]
  );
  const claims = account?.idTokenClaims || {};

  // stable AAD/B2C identifiers
  const userId = account?.localAccountId || claims?.oid || claims?.sub;

  // defaults from token
  const defaultEmail = useMemo(() => pickEmail(account, claims), [account, claims]);
  const defaultName = useMemo(
    () => pickName(account, claims, defaultEmail),
    [account, claims, defaultEmail]
  );

  const { profile, updateField, loading, error } = useUserProfile(userId);

  const [photo, setPhoto] = useState("");
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);

  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingSchool, setEditingSchool] = useState(false);

  // seed local state once the profile is loaded
  useEffect(() => {
    if (!loading) {
      setPhoto(profile?.photo || "");
      setName(profile?.name || defaultName);
      setEmail(profile?.email || defaultEmail);
      setGrade(profile?.grade || "");
      setSchool(profile?.school || "");
    }
  }, [loading, profile, defaultName, defaultEmail]);

  // handlers
  const saveName = async () => {
    await updateField("name", name);

    setEditingName(false);
  };
  const cancelName = () => {
    setName(profile?.name || defaultName);
    setEditingName(false);
  };

  const saveEmail = async () => {
    await updateField("email", email);

    setEditingEmail(false);
  };
  const cancelEmail = () => {
    setEmail(profile?.email || defaultEmail);
    setEditingEmail(false);
  };

  const saveSchool = async () => {
    // update both fields; your hook sends separate PUTs — fine for now
    await updateField("grade", grade);
    await updateField("school", school);
    setEditingSchool(false);
  };
  const cancelSchool = () => {
    setGrade(profile?.grade || "");
    setSchool(profile?.school || "");
    setEditingSchool(false);
  };

  const changePhoto = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      setPhoto(result);
      try {
        await updateField("photo", result);
      } catch (err) {
        console.error("Failed to update photo:", err);
      }
    };
    reader.onerror = (err) => console.error("Error reading file:", err);
    reader.readAsDataURL(file);
  };

  const resetPassword = async () => {
    try {
      await instance.loginRedirect({
        authority: b2cPolicies.authorities.passwordReset.authority,
        scopes: ["openid", "offline_access", "profile"],
        loginHint: defaultEmail || undefined,
        prompt: "login",
      });
    } catch (e) {
      const msg = e?.errorMessage || e?.message || "";
      if (msg.includes("AADB2C90118") || e?.errorCode === "AADB2C90118") {
        return instance.loginRedirect({
          authority: b2cPolicies.authorities.passwordReset.authority,
          scopes: ["openid", "offline_access", "profile"],
          loginHint: defaultEmail || undefined,
          prompt: "login",
        });
      }
      console.error("Password reset failed:", e);

      alert("Could not start password reset");
    }
  };

  if (!accounts?.length) return null; // brief guard during redirect
  if (loading) return <div className="p-8 text-center">Loading profile…</div>;


  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-gray-900">Profile Settings</h1>
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
            ← Back
          </Button>
        </div>
        {error && (
          <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
            There was a problem loading your profile. You can still edit fields below; changes will resync.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Personal Info */}
          <Card className="shadow-lg">
            <CardHeader className="flex items-center justify-between pb-6">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                Personal Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                  {photo ? (
                    <AvatarImage src={photo} alt="Avatar" className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-blue-100 to-purple-100">
                      <User className="h-16 w-16 text-gray-400" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <Label htmlFor="photo-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" className="gap-2 hover:bg-blue-50 bg-transparent">
                    <Camera className="h-4 w-4" />
                    Change Photo
                  </Button>
                  <input id="photo-upload" type="file" accept="image/*" onChange={changePhoto} className="hidden" />
                </Label>
              </div>

              {/* Username */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-gray-700">Username</Label>

                  {!editingName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingName(true)}
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                    >
                      <Pencil className="h-4 w-4 text-gray-500" />
                    </Button>
                  )}
                </div>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
                    <Button variant="ghost" size="sm" onClick={saveName} className="h-8 w-8 p-0 hover:bg-green-50">
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelName} className="h-8 w-8 p-0 hover:bg-red-50">

                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-gray-900 font-medium bg-gray-50 p-3 rounded-lg">{name}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-gray-700">Email</Label>
                  {!editingEmail && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingEmail(true)}
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                    >
                      <Pencil className="h-4 w-4 text-gray-500" />
                    </Button>
                  )}
                </div>
                {editingEmail ? (
                  <div className="flex items-center gap-2">
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
                    <Button variant="ghost" size="sm" onClick={saveEmail} className="h-8 w-8 p-0 hover:bg-green-50">
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelEmail} className="h-8 w-8 p-0 hover:bg-red-50">
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-gray-900 font-medium bg-gray-50 p-3 rounded-lg">{email || "—"}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* School & Grade */}
          <Card className="shadow-lg lg:col-span-2">
            <CardHeader className="flex items-center justify-between pb-6">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-green-100 rounded-lg">
                  <GraduationCap className="h-6 w-6 text-green-600" />
                </div>
                School & Grade
              </CardTitle>
              {!editingSchool && (
                <Button variant="ghost" size="sm" onClick={() => setEditingSchool(true)} className="h-8 w-8 p-0 hover:bg-gray-100">
                  <Pencil className="h-4 w-4 text-gray-500" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="grade" className="text-sm font-semibold text-gray-700">
                    Grade Level
                  </Label>
                  {editingSchool ? (
                    <Input
                      id="grade"
                      placeholder="e.g., Grade 10"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="h-12"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium bg-gray-50 p-3 rounded-lg">{grade || "—"}</p>

                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="school" className="text-sm font-semibold text-gray-700">
                    School
                  </Label>
                  {editingSchool ? (
                    <Input
                      id="school"
                      placeholder="Your school"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      className="h-12"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium bg-gray-50 p-3 rounded-lg">{school || "—"}</p>
                  )}
                </div>
              </div>
            </CardContent>
            {editingSchool && (
              <CardFooter className="pt-6 flex space-x-2">
                <Button onClick={saveSchool} className="bg-green-600 hover:bg-green-700 px-6">
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button variant="outline" onClick={cancelSchool} className="px-6">
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Security Settings */}
          <Card className="shadow-lg lg:col-span-3">
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Key className="h-6 w-6 text-red-600" />
                </div>
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-6 bg-red-50 rounded-lg border border-red-200">
                <div>
                  <h3 className="font-semibold text-gray-900">Password Reset</h3>
                  <p className="text-sm text-gray-600 mt-1">Reset your password to maintain account security</p>
                </div>
                <Button onClick={resetPassword} variant="destructive" className="gap-2 px-6">

                  <Key className="h-4 w-4" />
                  Reset Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
