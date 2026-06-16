import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Brain } from "lucide-react";
import { useMsal } from "@azure/msal-react";
import { protectedResources } from "../authConfig";

const SignIn = () => {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (accounts.length > 0) {
      navigate("/tools");
    }
  }, [accounts, navigate]);

  const handleLogin = async () => {
    try {
      setError(null);

      const result = await instance.loginPopup({
        scopes: protectedResources.todoListApi.scopes,
      });

      console.log("Login successful", result);

      if (result?.account) {
        instance.setActiveAccount(result.account);

        setTimeout(() => {
          navigate("/tools");
        }, 100);
      } else {
        setError("Authentication worked, but no account information was returned.");
      }
    } catch (error) {
      if (error.message && error.message.includes("user_cancelled")) {
        console.log("Login cancelled by user");
        return;
      }
      if (
        error.errorCode === "interaction_in_progress" ||
        error.message?.includes("interaction_in_progress")
      ) {
        setError("A sign-in window is already open. Please complete the current sign-in process before trying again.");
        return;
      }
      console.error("Login failed:", error);
      setError("Authentication failed: " + (error.message || "Unknown error"));
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow border border-gray-100">
        <div className="flex flex-col items-center text-center">
          <Brain className="h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in to BluStudy
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-6">
            Sign in to access your personalized study tools and start learning today.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignIn;