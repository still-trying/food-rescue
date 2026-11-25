import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type MessageRow = {
  id: string
  listing_id: string
  sender_id: string
  body: string
  created_at: string
}

type Props = {
  listingId: string
  currentUserId: string
  donorId: string
}

export default function PickupChatPanel({
  listingId,
  currentUserId,
  donorId,
}: Props) {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailableNotice, setUnavailableNotice] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadMessages = async () => {
      const { data, error: fetchError } = await supabase
        .from('listing_messages')
        .select('id, listing_id, sender_id, body, created_at')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (!mounted) return

      if (fetchError) {
        setUnavailableNotice(
          'In-app chat requires applying the latest Supabase migration (`listing_messages`).'
        )
        setLoading(false)
        return
      }

      setMessages(data ?? [])
      setLoading(false)
    }

    void loadMessages()

    const channel = supabase
      .channel(`listing-chat:${listingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'listing_messages',
          filter: `listing_id=eq.${listingId}`,
        },
        (payload) => {
          if (!mounted) return
          const inserted = payload.new as MessageRow
          setMessages((prev) =>
            prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]
          )
        }
      )
      .subscribe()

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [listingId])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || sending) return

    setError('')
    setSending(true)

    try {
      const { data, error: sendError } = await supabase.rpc(
        'send_listing_message',
        {
          p_listing_id: listingId,
          p_body: trimmed,
        }
      )

      if (sendError || !data) {
        setError(
          sendError?.message.toLowerCase().includes('could not find')
            ? 'In-app chat requires applying the latest Supabase migration.'
            : 'Unable to send message. Please try again.'
        )
        return
      }

      setDraft('')
      setMessages((prev) =>
        prev.some((m) => m.id === data.id) ? prev : [...prev, data]
      )
    } catch {
      setError('Something went wrong while sending your message.')
    } finally {
      setSending(false)
    }
  }

  if (unavailableNotice) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        {unavailableNotice}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        💬 Pickup Chat
      </p>

      <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-xs text-gray-500">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-gray-500">
            No messages yet. Coordinate pickup timing here.
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId
            const senderLabel = isMine
              ? 'You'
              : msg.sender_id === donorId
                ? 'Donor'
                : 'Claimant'
            return (
              <div
                key={msg.id}
                className={`rounded-lg px-3 py-2 text-xs ${
                  isMine
                    ? 'ml-6 bg-green-600 text-white'
                    : 'mr-6 border border-gray-200 bg-white text-gray-800'
                }`}
              >
                <p className="font-semibold opacity-80">{senderLabel}</p>
                <p className="mt-0.5 break-words">{msg.body}</p>
              </div>
            )
          })
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={(e) => void handleSend(e)} className="mt-2 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder="Write a message..."
          disabled={sending}
          aria-label="Pickup chat message"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-green-600"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

