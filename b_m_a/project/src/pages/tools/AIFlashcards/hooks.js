import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useMsal } from "@azure/msal-react";
import { protectedResources } from "../../../authConfig";

/**
 * Custom hook for managing flashcard data fetching and saving
 * @returns {Object} - Methods and state for quiz data management
 */
export const useDeckData = () => {
    const { instance, accounts, inProgress } = useMsal();
    const decksFetchedRef = useRef(false);
    const [savedDecks, setSavedDecks] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState("");

    // Get auth token silently
    const getToken = useCallback(async () => {
        // Check if MSAL is ready
        if (inProgress !== "none") {
            throw new Error(
                "Authentication service is initializing. Please try again later."
            );
        }

        // Get active account
        let account = instance.getActiveAccount();
        if (!account && accounts.length > 0) {
            instance.setActiveAccount(accounts[0]);
            account = accounts[0];
        }

        if (!account) {
            throw new Error("No active account found. Please sign in first.");
        }

        // Get token
        const tokenResponse = await instance.acquireTokenSilent({
            scopes: protectedResources.todoListApi.scopes,
            account: account,
        });

        return tokenResponse.accessToken;
    }, [instance, accounts, inProgress]);

    // Fetch saved decks
    const fetchSavedDecks = useCallback(async () => {
        try {
            // Check if MSAL is initialized
            if (inProgress !== "none") {
                return;
            }

            decksFetchedRef.current = true;

            const token = await getToken();
            const response = await axios.get("http://localhost:8000/decks", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setSavedDecks(response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching saved flashcard decks:", error);
            setError("Failed to load your saved flashcard decks. Please try again later.");
            return [];
        }
    }, [getToken, inProgress]);

    // Save a deck
    const saveDeck = useCallback(
        async (
            deckName,
            cards
        ) => {
            try {
                setIsSaving(true);
                setSaveSuccess(false);

                const token = await getToken();

                // Prepare deck data
                const deckData = {
                    contentType: "flashcard",
                    data: {
                        title: deckName,
                        cards: cards,
                    },
                };

                // Save to API
                const response = await axios.post(
                    "http://localhost:8000/save-flashcard",
                    deckData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                setSaveSuccess(true);
                decksFetchedRef.current = false;
                await fetchSavedDecks();
                return response.data;
            } catch (error) {
                console.error("Error saving quiz:", error);
                setError(
                    "Failed to save quiz: " +
                    (error.response?.data?.message || error.message)
                );
                return null;
            } finally {
                setIsSaving(false);
            }
        },
        [getToken, fetchSavedDecks]
    );

    return {
        savedDecks,
        isSaving,
        saveSuccess,
        error,
        fetchSavedDecks,
        saveDeck,
        decksFetchedRef,
    };
}