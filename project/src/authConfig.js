import { PublicClientApplication } from "@azure/msal-browser";

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const b2cPolicies = {
  names: {
    signUpSignIn: "B2C_1_signupsignin",
  },
  authorities: {
    signUpSignIn: {
      authority:
        "https://bluemarbleacademy.b2clogin.com/bluemarbleacademy.onmicrosoft.com/B2C_1_signupsignin",
    },
  },
  authorityDomain: "bluemarbleacademy.b2clogin.com",
};

export const msalConfig = {
  auth: {
    clientId: "966d3bf1-5512-4c9c-9af0-554ad974a7f5",
    authority: b2cPolicies.authorities.signUpSignIn.authority,
    knownAuthorities: [b2cPolicies.authorityDomain],
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const protectedResources = {
  todoListApi: {
    endpoint: API_BASE_URL,
    scopes: ["https://bluemarbleacademy.onmicrosoft.com/tasks-api/tasks.read"],
  },
  quizApi: {
    endpoint: API_BASE_URL,
    scopes: ["https://bluemarbleacademy.onmicrosoft.com/tasks-api/tasks.read"],
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);