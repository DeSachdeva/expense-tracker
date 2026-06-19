import { useEffect, useState } from 'react'

export default function Toast({ message, isError }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(true)
    const t = setTimeout(() => setShow(false), 3000)
    return () => clearTimeout(t)
  }, [message])

  return (
    <div className={`toast ${show ? 'show' : ''}`} style={{ background: isError ? '#dc2626' : '#1a1916' }}>
      {message}
    </div>
  )
}
