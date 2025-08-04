import React from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest, protectedResources } from "../authConfig";

export default function SignIn() {
  const { instance } = useMsal();

  const handleLogin = async () => {
    try {
      await instance.loginPopup({
        scopes: [
          ...loginRequest.scopes,
          ...protectedResources.api.scopes,
        ],
      });
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <button onClick={handleLogin}>
      Sign In
    </button>
  );
}
