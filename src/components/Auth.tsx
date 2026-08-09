import { useState } from 'react'
import { supabase } from '../lib/supabase'


type Props = {
  onAuthenticated: () => void
}

export default function Auth({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      })

      if (error) {
        setError(error.message)
      } else if (data.session) {
        onAuthenticated()
      } else {
        setMessage(
          'Account created. Please check your email if confirmation is enabled.'
        )
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        onAuthenticated()
      }
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="text-4xl">🍱</div>

          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Food Rescue
          </h1>

          <p className="mt-2 text-gray-500">
            Rescue surplus food. Reduce waste.
          </p>
        </div>

        <div className="mb-6 flex rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 rounded-lg py-2 font-medium ${
              mode === 'login'
                ? 'bg-white shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Login
          </button>

          <button
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-lg py-2 font-medium ${
              mode === 'signup'
                ? 'bg-white shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Name
              </label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-green-600"
                required
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-green-600"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-green-600"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Login'
                : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}