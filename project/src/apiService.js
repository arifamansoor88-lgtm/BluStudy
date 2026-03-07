// src/apiService.js
import { msalInstance, protectedResources } from "./authConfig"
import { InteractionRequiredAuthError } from "@azure/msal-browser"

async function acquireToken() {
  const accounts = msalInstance.getAllAccounts()
  const account = msalInstance.getActiveAccount() || accounts[0]
  if (!account) throw new Error("No active MSAL account — please sign in first.")

  const tokenRequest = {
    scopes: protectedResources.api.scopes,
    account,
  }

  try {
    const response = await msalInstance.acquireTokenSilent(tokenRequest)
    return response.accessToken
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      const response = await msalInstance.acquireTokenPopup(tokenRequest)
      return response.accessToken
    }
    throw e
  }
}

export async function getUserProfile(userId) {
  try {
    const token = await acquireToken()
    console.log("Token acquired:", token ? "✓" : "✗")

    const res = await fetch(`${protectedResources.api.endpoint}/user/${userId}/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    console.log("API Response status:", res.status)

    if (res.status === 401) {
      // Log more details about the 401 error
      const errorText = await res.text()
      console.error("401 Unauthorized error:", errorText)
      throw new Error(
        "Unauthorized — check that your token has the right scope and your backend API is properly configured",
      )
    }

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`API error ${res.status}:`, errorText)
      throw new Error(`API error: ${res.status} ${res.statusText}`)
    }

    return res.json()
  } catch (error) {
    console.error("getUserProfile error:", error)
    throw error
  }
}

export async function updateUserProfile(userId, field, value) {
  try {
    const token = await acquireToken()

    const res = await fetch(`${protectedResources.api.endpoint}/user/${userId}/profile`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [field]: value }),
    })

    if (res.status === 401) {
      const errorText = await res.text()
      console.error("401 Unauthorized error:", errorText)
      throw new Error("Unauthorized — check that your token has the right scope")
    }

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`API error ${res.status}:`, errorText)
      throw new Error(`API error: ${res.status} ${res.statusText}`)
    }

    return res.json()
  } catch (error) {
    console.error("updateUserProfile error:", error)
    throw error
  }
}
