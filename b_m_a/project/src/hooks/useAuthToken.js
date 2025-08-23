import { useState, useEffect, useCallback } from 'react'
import { useApiToken } from './useAuthToken'

export function useUserProfile(userId) {
  const getToken = useApiToken()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/user/${userId}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      setProfile(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [getToken, userId])

  useEffect(() => {
    if (userId) fetchProfile()
    else setLoading(false)
  }, [userId, fetchProfile])

  const updateField = useCallback(async (field, value) => {
    try {
      const token = await getToken()
      const res = await fetch(`/api/user/${userId}/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [field]: value })
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      setProfile(await res.json())
    } catch (e) {
      setError(e.message)
    }
  }, [getToken, userId])

  return { profile, loading, error, updateField }
}
