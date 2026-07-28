import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useMsal } from "@azure/msal-react";
import { protectedResources } from "../../../authConfig";
import { recordStudyToolUse } from "../../../api/apiService";
import { useGuest, guestFetch } from "../../../context/GuestContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Custom hook for managing flashcard data fetching and saving
 * @returns {Object} - Methods and state for quiz data management
 */
export const useDeckData = () => {
    const { instance, accounts, inProgress } = useMsal();
    const { isGuest } = useGuest();
    const decksFetchedRef = useRef(false);
    const [savedDecks, setSavedDecks] = useState([]);
    const [savedSpecificDeck, setSavedSpecificDeck] = useState([]);
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
        if (isGuest) return [];
        try {
            // Check if MSAL is initialized
            if (inProgress !== "none") {
                return;
            }

            decksFetchedRef.current = true;

            const token = await getToken();
            const response = await axios.get(`${API_BASE_URL}/decks`, {
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
    }, [getToken, inProgress, isGuest]);

    // Save a deck
    const saveDeck = useCallback(
        async (
            deckName,
            cards,
            folderId = null
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
                const requestBody = { ...deckData };
                if (folderId) {
                    requestBody.folder_id = folderId;
                }
                
                const response = await axios.post(
                    `${API_BASE_URL}/save-flashcard`,
                    requestBody,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                setSaveSuccess(true);
                await recordStudyToolUse("flashcard_deck", "save_flashcard_deck");
                decksFetchedRef.current = false;
                await fetchSavedDecks();
                return response.data.id;
            } catch (error) {
                console.error("Error saving deck:", error);
                setError(
                    "Failed to save deck: " +
                    (error.response?.data?.message || error.message)
                );
                return null;
            } finally {
                setIsSaving(false);
            }
        },
        [getToken, fetchSavedDecks]
    );

    // Delete a deck
    const deleteDeck = useCallback(
        async (deckId) => {
            try {
                setIsSaving(true);
                setSaveSuccess(false);


                const token = await getToken();
                // Call API
                const response = await axios.delete(
                    `${API_BASE_URL}/delete-deck/${deckId}`,
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
                console.error("Error saving deck:", error);
                setError(
                    "Failed to delete deck: " +
                    (error.response?.data?.message || error.message)
                );
                alert("Failed to delete deck!");
                return null;
            } finally {
                setIsSaving(false);
            }
        },
        [getToken, fetchSavedDecks]
    );

    const generateFlashcardsFromTopic = useCallback(
    async (topic, numCards = 10, folderId = null) => {
        try {
            // Guest mode: call public endpoint, no auth or Cosmos needed
            if (isGuest) {
                const deck = await guestFetch("/public/generate-flashcard-topic", {
                    method: "POST",
                    body: JSON.stringify({ topic, num_cards: Math.min(numCards, 20) }),
                });
                return deck;
            }

            const token = await getToken();

            const response = await axios.post(
                `${API_BASE_URL}/generate-flashcard-topic`,
                {
                    topic,
                    num_cards: numCards,
                    ...(folderId && { folder_id: folderId }),
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            decksFetchedRef.current = false;
            await fetchSavedDecks();
            await recordStudyToolUse("flashcard_deck", "generate_flashcards");

            return response.data;
        } catch (err) {
            console.error("Error generating flashcards from topic:", err);
            throw new Error(
                err.response?.data?.detail ||
                err.message ||
                "Failed to generate flashcards"
            );
        }
    },
    [getToken, fetchSavedDecks, isGuest]
);


    // Generate a new deck
    const generateFlashcards = useCallback(
        async (
            selectedFile,
            numCards,
            folderId = null
        ) => {
            try {
                if (isGuest) {
                    throw new Error("PDF upload requires an account. Please use the topic option instead.");
                }
                const token = await getToken();

                // Create a FormData object to send the file
                const formData = new FormData();
                formData.append("file", selectedFile);
                formData.append("num_cards", numCards.toString()); // Convert to string
                
                // Add folderId if provided
                if (folderId) {
                    formData.append("folder_id", folderId);
                }

                // Use a direct URL string to avoid URL construction issues
                const apiUrl = `${API_BASE_URL}/generate-flashcard`;

                // Send the file to the backend API
                const response = await axios.post(apiUrl, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "multipart/form-data",
                    },
                });
                await recordStudyToolUse("flashcard_deck", "generate_flashcards");
                return response.data;
            } catch (err) {
                console.error("Error generating quiz:", err);
                throw new Error(
                    err.response?.data?.detail || err.message || "Failed to generate quiz"
                );
            }
        },
        [getToken, isGuest]
    );

    // Get Flashcard by ID
    const getFlashcardByID = useCallback(async (deckId) => {
        try {
            // Check if MSAL is initialized
            if (inProgress !== "none") {
                return;
            }

            decksFetchedRef.current = true;

            const token = await getToken();
            const response = await axios.get(`${API_BASE_URL}/decks/${deckId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setSavedSpecificDeck(response.data);
            return response.data;
        } catch (error) {
            console.error(`Error fetching saved flashcard deck ${deckId}:`, error);
            setError(`Failed to load your saved flashcard deck ${deckId}. Please try again later.`);
            return [];
        }
    }, [getToken, inProgress]);


    // Update a deck
    const updateDeck = useCallback(
        async (deckName, deckId, updatedDeck) => {
            try {
                setIsSaving(true);
                setSaveSuccess(false);

                const token = await getToken();

                // Prepare the updated deck data
                const deckData = {
                    contentType: "flashcard",
                    data: {
                        title: deckName,
                        cards: updatedDeck,
                    },
                };

                // Send the updated deck to the server
                const response = await axios.put(
                    `${API_BASE_URL}/decks/${deckId}`,
                    deckData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                setSaveSuccess(true);
                await recordStudyToolUse("flashcard_deck", "update_flashcard_deck");
                decksFetchedRef.current = false;
                await fetchSavedDecks(); // Refresh the saved decks
                return response.data;
            } catch (error) {
                console.error("Error updating deck:", error);
                setError(
                    "Failed to update deck: " +
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
        deleteDeck,
        decksFetchedRef,
        generateFlashcardsFromTopic,
        generateFlashcards,
        getFlashcardByID,
        updateDeck,
    };
}
