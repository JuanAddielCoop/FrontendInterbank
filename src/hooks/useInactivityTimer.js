import { useEffect, useRef, useState } from 'react'

/**
 * Hook personalizado para detectar inactividad del usuario
 * @param {number} timeout - Tiempo en milisegundos de inactividad antes de activar
 * @param {function} onInactive - Callback cuando se detecta inactividad
 * @returns {object} - { isInactive, resetTimer }
 */
const useInactivityTimer = (timeout = 30000, onInactive) => {
  const [isInactive, setIsInactive] = useState(false)
  const timerRef = useRef(null)
  const onInactiveRef = useRef(onInactive)

  // Actualizar ref cuando cambie el callback
  useEffect(() => {
    onInactiveRef.current = onInactive
  }, [onInactive])

  const resetTimer = () => {
    setIsInactive(false)
    
    // Limpiar timer existente
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Crear nuevo timer
    timerRef.current = setTimeout(() => {
      setIsInactive(true)
      if (onInactiveRef.current) {
        onInactiveRef.current()
      }
    }, timeout)
  }

  useEffect(() => {
    if (!timeout) return

    // Eventos que indican actividad del usuario
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

    // Iniciar timer al montar
    resetTimer()

    // Agregar listeners para detectar actividad
    const handleActivity = () => resetTimer()
    
    events.forEach((event) => {
      window.addEventListener(event, handleActivity)
    })

    // Limpiar al desmontar
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [timeout]) // Solo depende de timeout


  return { isInactive, resetTimer }
}

export default useInactivityTimer

