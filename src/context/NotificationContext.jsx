import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import notificationSound from '../assets/notifications/notification.mp3'
import { getTransferHubUrl } from '../utils/api'
import { useAuth } from './AuthContext'
import { startSignalR, stopSignalR } from '../services/signalR.service'

const STORAGE_KEY = 'interbank-admin-notifications'
const MAX_NOTIFICATIONS = 50

const readStoredNotifications = () => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}


const persistNotifications = (notifications) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
  } catch {
    // ignore storage quota errors
  }
}

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `notif-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  removeNotification: () => {},
  clearNotifications: () => {},
  realtimeStatus: 'idle',
  lastRealtimeEvent: null,
})

export const NotificationProvider = ({ children }) => {
  const { token, refreshToken, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [notifications, setNotifications] = useState(() => readStoredNotifications())
  const [realtimeStatus, setRealtimeStatus] = useState('idle')
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    if (typeof Audio === 'undefined') return undefined
    const audio = new Audio(notificationSound)
    audio.preload = 'auto'
    audioRef.current = audio
    return () => {
      audio.pause()
      audioRef.current = null
    }
  }, [])

  const playNotificationSound = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    try {
      audio.currentTime = 0
      const playPromise = audio.play()
      if (playPromise?.catch) {
        playPromise.catch(() => {})
      }
    } catch {
      /* ignore playback issues */
    }
  }, [])

  useEffect(() => {
    persistNotifications(notifications)
  }, [notifications])

  const addNotification = useCallback(
    (payload) => {
      setNotifications((prev) => {
        const next = [
          {
            id: payload.id ?? createId(),
            title: payload.title ?? 'Notificacion',
            message: payload.message ?? '',
            meta: payload.meta ?? {},
            timestamp: payload.timestamp ?? Date.now(),
            read: false,
          },
          ...prev,
        ].slice(0, MAX_NOTIFICATIONS)
        return next
      })
      playNotificationSound()
    },
    [playNotificationSound],
  )

  useEffect(() => {
    const hubUrl = getTransferHubUrl()
    let cancelled = false

    const connect = async () => {
      if (!hubUrl) {
        setRealtimeStatus('disabled')
        return
      }
      if (!isAuthenticated || !token) {
        setRealtimeStatus('idle')
        return
      }
      setRealtimeStatus('connecting')
      await startSignalR({
        hubUrl,
        token,
        refreshToken,
        queryClient,
        onStatusChange: (status) => {
          if (!cancelled) setRealtimeStatus(status)
        },
        onNotification: (payload) => {
          if (cancelled) return
          addNotification(payload)
          setLastRealtimeEvent({
            id: payload.id ?? createId(),
            eventName: payload.meta?.eventName ?? 'realtime',
            meta: payload.meta ?? {},
            payload,
            timestamp: Date.now(),
          })
        },
        onEvent: ({ eventName, payload }) => {
          if (cancelled) return
          setLastRealtimeEvent({
            id: payload?.id ?? createId(),
            eventName,
            meta: payload?.meta ?? {},
            payload,
            timestamp: Date.now(),
          })
        },
      })
    }

    const connectTimer = window.setTimeout(connect, 0)

    return () => {
      cancelled = true
      window.clearTimeout(connectTimer)
      stopSignalR()
    }
  }, [addNotification, isAuthenticated, token, queryClient])

  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
  }, [])

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const value = useMemo(() => {
    const unreadCount = notifications.reduce((count, notif) => (notif.read ? count : count + 1), 0)
    return {
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearNotifications,
      realtimeStatus,
      lastRealtimeEvent,
    }
  }, [
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
    realtimeStatus,
    lastRealtimeEvent,
  ])

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export const useNotifications = () => useContext(NotificationContext)
