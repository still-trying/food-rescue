import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type UseAuthOptions = {
  onSignedOut: () => void
  onError: (message: string) => void
}

export function useAuth({ onSignedOut, onError }: UseAuthOptions) {
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(false)

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          if (import.meta.env.DEV) {
            console.error('Session error:', sessionError)
          }
          if (mounted) {
            onError('Unable to verify your session. Please refresh the page.')
          }
          return
        }

        if (mounted) {
          setUserId(session?.user?.id ?? null)
          setUserEmail(session?.user?.email ?? null)
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Application initialization error:', err)
        }
        if (mounted) {
          onError('Unable to load Food Rescue. Please refresh the page.')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) {
        return
      }

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryOpen(true)
      }

      const nextUserId = session?.user?.id ?? null
      setUserId(nextUserId)
      setUserEmail(session?.user?.email ?? null)

      if (!nextUserId) {
        setPasswordRecoveryOpen(false)
        onSignedOut()
      }

      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [onError, onSignedOut])

  const handleLogout = useCallback(async () => {
    if (loggingOut) {
      return
    }

    onError('')
    setLoggingOut(true)

    try {
      const { error: logoutError } = await supabase.auth.signOut()

      if (logoutError) {
        if (import.meta.env.DEV) {
          console.error('Logout error:', logoutError)
        }
        onError('Unable to log out. Please try again.')
        return
      }

      setUserId(null)
      setUserEmail(null)
      setPasswordRecoveryOpen(false)
      onSignedOut()
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Unexpected logout error:', err)
      }
      onError('Something went wrong while logging out.')
    } finally {
      setLoggingOut(false)
    }
  }, [loggingOut, onError, onSignedOut])

  const handleAuthenticated = useCallback(async () => {
    onError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        if (import.meta.env.DEV) {
          console.error('Authentication verification error:', userError)
        }
        onError('Unable to verify your account. Please try again.')
        return
      }

      if (user) {
        setUserId(user.id)
        setUserEmail(user.email ?? null)
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Unexpected authentication error:', err)
      }
      onError('Something went wrong while signing you in.')
    }
  }, [onError])

  return {
    userId,
    userEmail,
    loading,
    loggingOut,
    passwordRecoveryOpen,
    dismissPasswordRecovery: () => setPasswordRecoveryOpen(false),
    handleLogout,
    handleAuthenticated,
  }
}

