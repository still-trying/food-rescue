import { useState } from 'react'
import type { Theme } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import AmbientBackground from './AmbientBackground'
import ThemeToggle from './ThemeToggle'

type Props = {
  onAuthenticated: () => void
  initialMode?: 'login' | 'signup'
  onBack?: () => void
  theme?: Theme
  onToggleTheme?: () => void
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

export default function Auth({
  onAuthenticated,
  initialMode = 'login',
  onBack,
  theme = 'light',
  onToggleTheme,
}: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
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
    <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <AmbientBackground />

      {onBack && (
        <div className="fixed left-5 top-5 z-20">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300/80 bg-white/85 px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/25 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-900/60"
          >
            ← Back to Home
          </button>
        </div>
      )}

      {onToggleTheme && (
        <div className="fixed right-5 top-5 z-20">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      )}

      <div className="fr-surface-3d w-full max-w-md rounded-3xl border border-slate-200/80 p-8 dark:border-emerald-500/20">
        <div className="mb-8 text-center">
          <div className="mx-auto inline-flex overflow-hidden rounded-2xl bg-[#faf8f5] p-2 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/15">
            <img
              src="/logo.jpg"
              alt="Food Rescue logo"
              className="h-16 w-auto rounded-xl object-contain"
            />
          </div>

          <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-50">
            Food Rescue
          </h1>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Share Food • Reduce Waste • Nourish Lives
          </p>
        </div>

        {mode !== 'reset' ? (
          <div
            className="mb-6 flex rounded-xl bg-slate-100/90 p-1 dark:bg-emerald-950/70"
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
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-emerald-800/70 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-emerald-800/70 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Sign Up
            </button>
          </div>
        ) : (
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Reset Password
            </h2>
            <button
              type="button"
              onClick={() => switchMode('login')}
              disabled={loading}
              className="text-sm font-medium text-green-700 hover:underline dark:text-emerald-400"
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
                className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
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
                className="w-full rounded-xl border border-slate-300 bg-white/90 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-500/20 disabled:bg-slate-100 dark:border-emerald-500/25 dark:bg-[#0b1511]/80 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-400 dark:disabled:bg-slate-900"
                required
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
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
              className="w-full rounded-xl border border-slate-300 bg-white/90 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-500/20 disabled:bg-slate-100 dark:border-emerald-500/25 dark:bg-[#0b1511]/80 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-400 dark:disabled:bg-slate-900"
              required
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Password
                </label>

                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    disabled={loading}
                    className="text-xs font-medium text-green-700 hover:underline dark:text-emerald-400"
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
                className="w-full rounded-xl border border-slate-300 bg-white/90 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-500/20 disabled:bg-slate-100 dark:border-emerald-500/25 dark:bg-[#0b1511]/80 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-400 dark:disabled:bg-slate-900"
                required
              />

              {mode === 'signup' && (
                <p
                  id="password-help"
                  className="mt-1 text-xs text-slate-500 dark:text-slate-400"
                >
                  Password must be at least 6 characters.
                </p>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50/95 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300"
            >
              <div className="flex items-start justify-between gap-3">
                <p>⚠️ {error}</p>

                <button
                  type="button"
                  onClick={() => setError('')}
                  className="font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
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
              className="rounded-xl border border-green-200 bg-green-50/95 p-3 text-sm text-green-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300"
            >
              <div className="flex items-start justify-between gap-3">
                <p>✓ {message}</p>

                <button
                  type="button"
                  onClick={() => setMessage('')}
                  className="font-bold text-green-600 hover:text-green-800 dark:text-emerald-400 dark:hover:text-emerald-200"
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
            className="fr-btn-3d w-full rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
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
