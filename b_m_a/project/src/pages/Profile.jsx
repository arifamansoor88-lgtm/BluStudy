// src/pages/Profile.jsx
"use client";

import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { b2cPolicies } from "../authConfig";
import { useNavigate } from "react-router-dom";
import {
  User,
  Camera,
  Key,
  Pencil,
  Check,
  X,
  GraduationCap,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useUserProfile } from "../hooks/useUserProfile";

export default function Profile() {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const account = instance.getActiveAccount() || accounts[0] || {};
  const userId = account.localAccountId;

  const { profile, updateField, loading, error } = useUserProfile(userId);

  const defaultName =
    (account.idTokenClaims && account.idTokenClaims.name) ||
    (account.username && account.username.split("@")[0]) ||
    "User";
  const defaultEmail =
    account.username || (account.idTokenClaims && account.idTokenClaims.preferred_username) || "";

  const [photo, setPhoto] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingSchool, setEditingSchool] = useState(false);

  // Seed state once profile loads
  useEffect(() => {
    if (!loading && profile) {
      setPhoto(profile.photo || "");
      setName(profile.name || defaultName);
      setEmail(profile.email || defaultEmail);
      setGrade(profile.grade || "");
      setSchool(profile.school || "");
    }
  }, [loading, profile, defaultName, defaultEmail]);

  // Handlers
  const saveName = () => {
    updateField("name", name);
    setEditingName(false);
  };
  const cancelName = () => {
    setName(profile?.name || defaultName);
    setEditingName(false);
  };

  const saveEmail = () => {
    updateField("email", email);
    setEditingEmail(false);
  };
  const cancelEmail = () => {
    setEmail(profile?.email || defaultEmail);
    setEditingEmail(false);
  };

  const saveSchool = () => {
    updateField("grade", grade);
    updateField("school", school);
    setEditingSchool(false);
  };
  const cancelSchool = () => {
    setGrade(profile?.grade || "");
    setSchool(profile?.school || "");
    setEditingSchool(false);
  };

  // Photo upload handler (untyped for JSX)
  const changePhoto = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        console.error("Expected FileReader result to be a string");
        return;
      }
      setPhoto(result);
      try {
        updateField("photo", result);
      } catch (err) {
        console.error("Failed to update photo field:", err);
      }
    };

    reader.onerror = (err) => {
      console.error("Error reading file:", err);
    };

    reader.readAsDataURL(file);
  };

  // Trigger B2C password reset
  const resetPassword = async () => {
    try {
      await instance.loginPopup({
        authority: b2cPolicies.authorities.passwordReset.authority,
        scopes: ["openid", "profile"],
      });
      alert("Reset complete");
    } catch {
      alert("Could not start password reset");
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading profile…</div>;
  }
  if (error) {
    console.warn("Profile load error:", error);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-gray-900">
            Profile Settings
          </h1>
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back
          </Button>
        </div>

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
                    <AvatarImage
                      src={photo}
                      alt="Avatar"
                      className="object-cover"
                    />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-blue-100 to-purple-100">
                      <User className="h-16 w-16 text-gray-400" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <Label htmlFor="photo-upload" className="cursor-pointer">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 hover:bg-blue-50 bg-transparent"
                  >
                    <Camera className="h-4 w-4" />
                    Change Photo
                  </Button>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={changePhoto}
                    className="hidden"
                  />
                </Label>
              </div>

              {/* Username */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-gray-700">
                    Username
                  </Label>
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
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={saveName}
                      className="h-8 w-8 p-0 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelName}
                      className="h-8 w-8 p-0 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-gray-900 font-medium bg-gray-50 p-3 rounded-lg">
                    {name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-gray-700">
                    Email
                  </Label>
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
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={saveEmail}
                      className="h-8 w-8 p-0 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelEmail}
                      className="h-8 w-8 p-0 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-gray-900 font-medium bg-gray-50 p-3 rounded-lg">
                    {email}
                  </p>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingSchool(true)}
                  className="h-8 w-8 p-0 hover:bg-gray-100"
                >
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
                    <p className="text-gray-900 font-medium bg-gray-50 p-3 rounded-lg">
                      {grade || "—"}
                    </p>
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
                    <p className="text-gray-900 font-medium bg-gray-50 p-3 rounded-lg">
                      {school || "—"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
            {editingSchool && (
              <CardFooter className="pt-6 flex space-x-2">
                <Button
                  onClick={saveSchool}
                  className="bg-green-600 hover:bg-green-700 px-6"
                >
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
                  <p className="text-sm text-gray-600 mt-1">
                    Reset your password to maintain account security
                  </p>
                </div>
                <Button
                  onClick={resetPassword}
                  variant="destructive"
                  className="gap-2 px-6"
                >
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
