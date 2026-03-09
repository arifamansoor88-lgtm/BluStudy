// src/hooks/useApiToken.js
import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { protectedResources } from "../authConfig";

export function useApiToken() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  return useCallback(async () => {
    try {
      const result = await instance.acquireTokenSilent({
        account,
        scopes: protectedResources.api.scopes
      });
      return result.accessToken;
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const result = await instance.acquireTokenPopup({
          scopes: protectedResources.api.scopes
        });
        return result.accessToken;
      }
      throw e;
    }
  }, [instance, account]);
}
