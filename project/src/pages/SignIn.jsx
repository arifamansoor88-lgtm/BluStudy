import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brain } from "lucide-react";
import { useMsal } from "@azure/msal-react";
import { protectedResources } from "../authConfig";

const SignIn = () => {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  // If user is already signed in, redirect to dashboard
  useEffect(() => {
    if (accounts.length > 0) {
      navigate("/dashboard");
    }
  }, [accounts, navigate]);

  const handleLogin = async () => {
    try {
      setError(null);

      // Simple login with popup
      const result = await instance.loginPopup({
        scopes: protectedResources.todoListApi.scopes,
      });

      console.log("Login successful", result);

      // Set active account and redirect to dashboard
      if (result?.account) {
        instance.setActiveAccount(result.account);

        // Short timeout to ensure state is updated before redirect
        setTimeout(() => {
          navigate("/dashboard");
        }, 100);
      } else {
        setError(
          "Login was successful, but no account information was returned"
        );
      }
    } catch (error) {
      // Don't show error for user cancellation
      if (error.message && error.message.includes("user_cancelled")) {
        console.log("Login cancelled by user");
        return;
      }

      console.error("Login failed:", error);
      setError("Login failed: " + (error.message || "Unknown error"));
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow">
        <div className="flex flex-col items-center">
          <Brain className="h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please sign in with your Azure AD B2C account
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign in / Sign up with Azure AD
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
