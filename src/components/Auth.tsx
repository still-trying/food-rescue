import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  onAuthenticated: () => void
}

type AuthMode = 'login' | 'signup' | 'reset'

function getAuthErrorMessage(errorMessage: string) {
  const message = errorMessage.toLowerCase()

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials')
  ) {
    return 'Incorrect email or password.'
  }

  if (message.includes('email not confirmed')) {
    return 'Please confirm your email address before logging in.'
  }

  if (message.includes('user already registered')) {
    return 'An account with this email already exists. Try logging in instead.'
  }

  if (message.includes('password')) {
    return 'Please check your password and try again.'
  }

  if (message.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Unable to connect to the server. Please check your internet connection.'
  }

  return 'Something went wrong. Please try again.'
}

export default function Auth({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const switchMode = (newMode: AuthMode) => {
    if (loading) {
      return
    }
    setMode(newMode)
    setError('')
    setMessage('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (loading) {
      return
    }

    setError('')
    setMessage('')

    const normalizedEmail = email.trim().toLowerCase()
    const trimmedName = name.trim()

    if (!normalizedEmail) {
      setError('Please enter your email address.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    if (mode === 'signup') {
      if (!trimmedName) {
        setError('Please enter your name.')
        return
      }
      if (trimmedName.length > 100) {
        setError('Name must be 100 characters or less.')
        return
      }
    }

    if (mode !== 'reset') {
      if (!password) {
        setError('Please enter your password.')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          { redirectTo: window.location.origin }
        )

        if (resetError) {
          if (import.meta.env.DEV) {
            console.error('Password reset error:', resetError)
          }
          setError(getAuthErrorMessage(resetError.message))
          return
        }

        setMessage(
          'If an account exists for that email, a password reset link has been sent.'
        )
        return
      }

      if (mode === 'signup') {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: trimmedName,
            },
          },
        })

        if (signupError) {
          if (import.meta.env.DEV) {
            console.error('Signup error:', signupError)
          }
          setError(getAuthErrorMessage(signupError.message))
          return
        }

        if (data.user && data.user.identities?.length === 0) {
          setError(
            'An account with this email already exists. Try logging in instead.'
          )
          return
        }

        if (data.session) {
          onAuthenticated()
          return
        }

        setMessage(
          'Account created successfully. Please check your email if confirmation is enabled.'
        )
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (loginError) {
          if (import.meta.env.DEV) {
            console.error('Login error:', loginError)
          }
          setError(getAuthErrorMessage(loginError.message))
          return
        }

        onAuthenticated()
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Unexpected authentication error:', err)
      }
      setError(
        'Something went wrong while authenticating. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="text-4xl" aria-hidden="true">
            🍱
          </div>

          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Food Rescue
          </h1>

          <p className="mt-2 text-gray-500">
            Rescue surplus food. Reduce waste.
          </p>
        </div>

        {mode !== 'reset' ? (
          <div
            className="mb-6 flex rounded-xl bg-gray-100 p-1"
            role="tablist"
            aria-label="Authentication mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              disabled={loading}
              className={`flex-1 rounded-lg py-2 font-medium transition ${
                mode === 'login'
                  ? 'bg-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Login
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => switchMode('signup')}
              disabled={loading}
              className={`flex-1 rounded-lg py-2 font-medium transition ${
                mode === 'signup'
                  ? 'bg-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Sign Up
            </button>
          </div>
        ) : (
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Reset Password
            </h2>
            <button
              type="button"
              onClick={() => switchMode('login')}
              disabled={loading}
              className="text-sm font-medium text-green-700 hover:underline"
            >
              Back to Login
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold"
              >
                Name
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
                autoComplete="name"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-600 disabled:bg-gray-100"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold">
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-600 disabled:bg-gray-100"
              required
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold"
                >
                  Password
                </label>

                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    disabled={loading}
                    className="text-xs font-medium text-green-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                disabled={loading}
                aria-describedby={
                  mode === 'signup' ? 'password-help' : undefined
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-600 disabled:bg-gray-100"
                required
              />

              {mode === 'signup' && (
                <p id="password-help" className="mt-1 text-xs text-gray-500">
                  Password must be at least 6 characters.
                </p>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <div className="flex items-start justify-between gap-3">
                <p>⚠️ {error}</p>

                <button
                  type="button"
                  onClick={() => setError('')}
                  className="font-bold text-red-500 hover:text-red-700"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {message && (
            <div
              role="status"
              className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
            >
              <div className="flex items-start justify-between gap-3">
                <p>✓ {message}</p>

                <button
                  type="button"
                  onClick={() => setMessage('')}
                  className="font-bold text-green-600 hover:text-green-800"
                  aria-label="Dismiss message"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? mode === 'login'
                ? 'Logging in...'
                : mode === 'signup'
                  ? 'Creating account...'
                  : 'Sending reset link...'
              : mode === 'login'
                ? 'Login'
                : mode === 'signup'
                  ? 'Create Account'
                  : 'Send Reset Link'}
          </button>
        </form>
      </div>
    </div>
  )
}
