// src/authConfig.js
import { PublicClientApplication } from "@azure/msal-browser";

// ==== B2C Policy Configuration ====
export const b2cPolicies = {
  names: {
    signUpSignIn: "B2C_1_signupsignin"
  },
  authorities: {
    signUpSignIn: {
      authority:
        "https://bluemarbleacademy.b2clogin.com/bluemarbleacademy.onmicrosoft.com/B2C_1_signupsignin"
    },
    passwordReset: {
      authority:
        "https://bluemarbleacademy.b2clogin.com/bluemarbleacademy.onmicrosoft.com/B2C_1_passwordreset"
    }
  },
  authorityDomain: "bluemarbleacademy.b2clogin.com"
};

// ==== MSAL Client Configuration ====
export const msalConfig = {
  auth: {
    clientId: "966d3bf1-5512-4c9c-9af0-554ad974a7f5",
    authority: b2cPolicies.authorities.signUpSignIn.authority,
    knownAuthorities: [b2cPolicies.authorityDomain],
    redirectUri: "http://localhost:5173"
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false
  }
};

// Single shared MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);

// ==== Your API’s “Expose an API” settings in Azure B2C ====
export const protectedResources = {
  api: {
    endpoint: "http://localhost:8000/api",
    scopes: [
      // EXACTLY the scope URI you configured under “Expose an API” 
      // in Azure Portal for your backend registration:
      "https://bluemarbleacademy.onmicrosoft.com/bluemarbleapi/user_impersonation"
    ]
  }
  todoListApi: {
    endpoint: "http://127.0.0.1:8000",
    scopes: ["https://bluemarbleacademy.onmicrosoft.com/tasks-api/tasks.read"],
  },
  quizApi: {
    endpoint: "http://127.0.0.1:8000",
    scopes: ["https://bluemarbleacademy.onmicrosoft.com/tasks-api/tasks.read"],
  },
};

// Scopes requested at login
export const loginRequest = {
  scopes: ["openid", "profile", "email", ...protectedResources.api.scopes]
};
