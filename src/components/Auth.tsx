import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  onAuthenticated: () => void
}

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

  if (
    message.includes('network') ||
    message.includes('fetch')
  ) {
    return 'Unable to connect to the server. Please check your internet connection.'
  }

  return 'Something went wrong. Please try again.'
}

export default function Auth({
  onAuthenticated,
}: Props) {
  const [mode, setMode] = useState<
    'login' | 'signup'
  >('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const switchMode = (
    newMode: 'login' | 'signup'
  ) => {
    if (loading) {
      return
    }

    setMode(newMode)
    setError('')
    setMessage('')
  }

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    if (loading) {
      return
    }

    setError('')
    setMessage('')

    const normalizedEmail =
      email.trim().toLowerCase()

    const trimmedName = name.trim()

    // Basic validation
    if (!normalizedEmail) {
      setError('Please enter your email address.')
      return
    }

    if (!normalizedEmail.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    if (mode === 'signup') {
      if (!trimmedName) {
        setError('Please enter your name.')
        return
      }

      if (trimmedName.length > 100) {
        setError(
          'Name must be 100 characters or less.'
        )
        return
      }
    }

    if (!password) {
      setError('Please enter your password.')
      return
    }

    if (password.length < 6) {
      setError(
        'Password must be at least 6 characters.'
      )
      return
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error } =
          await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              data: {
                full_name: trimmedName,
              },
            },
          })

        if (error) {
          console.error(
            'Signup error:',
            error
          )

          setError(
            getAuthErrorMessage(error.message)
          )
          return
        }

        // Existing account (Supabase obfuscates this)
if (data.user && data.user.identities?.length === 0) {
  setError(
    'An account with this email already exists. Try logging in instead.'
  )
  return
}

// New account with auto-login
if (data.session) {
  onAuthenticated()
  return
}

// New account requiring email confirmation
setMessage(
  'Account created successfully. Please check your email if confirmation is enabled.'
)
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })

        if (error) {
          console.error(
            'Login error:',
            error
          )

          setError(
            getAuthErrorMessage(error.message)
          )
          return
        }

        onAuthenticated()
      }
    } catch (err) {
      console.error(
        'Unexpected authentication error:',
        err
      )

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

        {/* Header */}
        <div className="mb-8 text-center">
          <div
            className="text-4xl"
            aria-hidden="true"
          >
            🍱
          </div>

          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Food Rescue
          </h1>

          <p className="mt-2 text-gray-500">
            Rescue surplus food. Reduce waste.
          </p>
        </div>

        {/* Login / Signup switch */}
        <div
          className="mb-6 flex rounded-xl bg-gray-100 p-1"
          role="tablist"
          aria-label="Authentication mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() =>
              switchMode('login')
            }
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
            onClick={() =>
              switchMode('signup')
            }
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

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          noValidate
        >

          {/* Name */}
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
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Your name"
                maxLength={100}
                autoComplete="name"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-600 disabled:bg-gray-100"
                required
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-600 disabled:bg-gray-100"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="••••••••"
              minLength={6}
              autoComplete={
                mode === 'login'
                  ? 'current-password'
                  : 'new-password'
              }
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-600 disabled:bg-gray-100"
              required
            />

            {mode === 'signup' && (
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 6 characters.
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <div className="flex items-start justify-between gap-3">
                <p>⚠️ {error}</p>

                <button
                  type="button"
                  onClick={() =>
                    setError('')
                  }
                  className="font-bold text-red-500 hover:text-red-700"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Success / informational message */}
          {message && (
            <div
              role="status"
              className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
            >
              <div className="flex items-start justify-between gap-3">
                <p>✓ {message}</p>

                <button
                  type="button"
                  onClick={() =>
                    setMessage('')
                  }
                  className="font-bold text-green-600 hover:text-green-800"
                  aria-label="Dismiss message"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? mode === 'login'
                ? 'Logging in...'
                : 'Creating account...'
              : mode === 'login'
                ? 'Login'
                : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}