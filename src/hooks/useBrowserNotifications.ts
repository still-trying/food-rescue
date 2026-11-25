import { useCallback, useState } from 'react'

export type NotificationPermissionState =
  | 'default'
  | 'granted'
  | 'denied'
  | 'unsupported'

function getInitialPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

export function useBrowserNotifications() {
  const [permission, setPermission] =
    useState<NotificationPermissionState>(getInitialPermission)
  const [enabled, setEnabled] = useState(
    () => getInitialPermission() === 'granted'
  )

  const toggleNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return
    }

    if (permission === 'granted') {
      setEnabled((prev) => !prev)
      return
    }

    const result = await Notification.requestPermission()
    setPermission(result)
    setEnabled(result === 'granted')
  }, [permission])

  const notifyIfEnabled = useCallback(
    (title: string, body: string) => {
      if (
        !enabled ||
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        Notification.permission !== 'granted'
      ) {
        return
      }

      if (document.visibilityState === 'visible') {
        return
      }

      try {
        new Notification(title, {
          body,
          icon: '/favicon.svg',
          tag: 'food-rescue-alert',
        })
      } catch {
        // Ignore browser notification errors in restricted contexts.
      }
    },
    [enabled]
  )

  return {
    permission,
    notificationsEnabled: enabled && permission === 'granted',
    toggleNotifications,
    notifyIfEnabled,
  }
}

