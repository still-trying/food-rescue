import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  onClose: () => void
}

export default function ResetPasswordModal({ onClose }: Props) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    setError('')

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        if (import.meta.env.DEV) {
          console.error('Update password error:', updateError)
        }
        setError('Unable to update password. Please request a fresh reset link.')
        return
      }

      setSuccess(true)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Unexpected password update error:', err)
      }
      setError('Something went wrong while updating your password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="reset-password-title"
              className="text-xl font-bold text-gray-900"
            >
              Set a New Password
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Choose a new password for your Food Rescue account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close password reset dialog"
            className="text-lg font-bold text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="mt-5 space-y-4">
            <div
              role="status"
              className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
            >
              ✓ Your password has been updated successfully.
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              Continue to Food Rescue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="recovery-new-password"
                className="mb-1.5 block text-sm font-semibold"
              >
                New password
              </label>
              <input
                id="recovery-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                disabled={saving}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
              />
            </div>

            <div>
              <label
                htmlFor="recovery-confirm-password"
                className="mb-1.5 block text-sm font-semibold"
              >
                Confirm new password
              </label>
              <input
                id="recovery-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                disabled={saving}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                ⚠️ {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

