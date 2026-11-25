import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { OrganizationType } from '../types/listing'

type Props = {
  userId: string
  userEmail: string | null
  onClose: () => void
}

const ORG_TYPES: readonly { value: OrganizationType; label: string }[] = [
  { value: 'individual', label: 'Individual Donor / Rescuer' },
  { value: 'restaurant', label: 'Restaurant / Kitchen' },
  { value: 'bakery', label: 'Bakery / Cafe' },
  { value: 'ngo', label: 'NGO / Community Shelter' },
  { value: 'catering', label: 'Catering / Event' },
  { value: 'grocery', label: 'Grocery / Supermarket' },
] as const

export default function ProfileModal({
  userId,
  userEmail,
  onClose,
}: Props) {
  const [displayName, setDisplayName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationType, setOrganizationType] =
    useState<OrganizationType>('individual')
  const [isVerified, setIsVerified] = useState(false)
  const [hasExistingProfile, setHasExistingProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNotice, setSavedNotice] = useState('')

  useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!mounted) return

      if (fetchError) {
        setError(
          'User profiles require applying the latest Supabase migration (`profiles`).'
        )
        setLoading(false)
        return
      }

      if (data) {
        setHasExistingProfile(true)
        setDisplayName(data.display_name ?? '')
        setOrganizationName(data.organization_name ?? '')
        setOrganizationType(data.organization_type ?? 'individual')
        setIsVerified(data.is_verified)
      }
      setLoading(false)
    }

    void loadProfile()

    return () => {
      mounted = false
    }
  }, [userId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || loading) return

    setError('')
    setSavedNotice('')
    setSaving(true)

    try {
      const payload = {
        display_name: displayName.trim() || null,
        organization_name: organizationName.trim() || null,
        organization_type: organizationType,
        updated_at: new Date().toISOString(),
      }

      const { error: saveError } = hasExistingProfile
        ? await supabase.from('profiles').update(payload).eq('id', userId)
        : await supabase.from('profiles').insert({ id: userId, ...payload })

      if (saveError) {
        setError(
          'Unable to save profile. Ensure the `profiles` migration is applied.'
        )
        return
      }

      setHasExistingProfile(true)
      setSavedNotice('Profile saved successfully.')
    } catch {
      setError('Something went wrong while saving your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="profile-modal-title"
              className="text-xl font-bold text-gray-900"
            >
              Your Profile
            </h2>
            <p className="mt-1 text-xs text-gray-500">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile dialog"
            className="text-lg font-bold text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="mt-3">
          {isVerified ? (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              ✓ Verified Organization
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
              Standard Community Account
            </span>
          )}
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-gray-500">Loading profile...</p>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="mt-5 space-y-4"
          >
            <div>
              <label
                htmlFor="profile-display-name"
                className="mb-1.5 block text-xs font-semibold text-gray-700"
              >
                Display Name
              </label>
              <input
                id="profile-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                placeholder="Your name or volunteer handle"
                disabled={saving}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
              />
            </div>

            <div>
              <label
                htmlFor="profile-org-type"
                className="mb-1.5 block text-xs font-semibold text-gray-700"
              >
                Account Type
              </label>
              <select
                id="profile-org-type"
                value={organizationType}
                onChange={(e) =>
                  setOrganizationType(e.target.value as OrganizationType)
                }
                disabled={saving}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-600"
              >
                {ORG_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-org-name"
                className="mb-1.5 block text-xs font-semibold text-gray-700"
              >
                Organization / Kitchen Name (optional)
              </label>
              <input
                id="profile-org-name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                maxLength={120}
                placeholder="e.g. Hope Community Kitchen"
                disabled={saving}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
              >
                ⚠️ {error}
              </div>
            )}

            {savedNotice && (
              <div
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-800"
              >
                ✓ {savedNotice}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

