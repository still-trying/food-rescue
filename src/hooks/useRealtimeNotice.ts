import { useCallback, useEffect, useRef, useState } from 'react'

const NOTICE_DURATION_MS = 4000

export function useRealtimeNotice() {
  const [realtimeNotice, setRealtimeNotice] = useState('')
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noticeRef = useRef('')

  const clearRealtimeNotice = useCallback(() => {
    noticeRef.current = ''
    setRealtimeNotice('')
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = null
    }
  }, [])

  const showRealtimeNotice = useCallback((message: string) => {
    if (noticeRef.current === message) {
      return
    }

    noticeRef.current = message
    setRealtimeNotice(message)

    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current)
    }

    noticeTimerRef.current = setTimeout(() => {
      noticeRef.current = ''
      setRealtimeNotice('')
      noticeTimerRef.current = null
    }, NOTICE_DURATION_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current)
        noticeTimerRef.current = null
      }
    }
  }, [])

  return {
    realtimeNotice,
    showRealtimeNotice,
    clearRealtimeNotice,
  }
}

