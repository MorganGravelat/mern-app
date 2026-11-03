import { useCallback, useEffect, useState } from 'react'
import { errorText } from '../api'
import { useAuth } from '../auth/useAuth'

// Loads one API path when the page opens (and again when the path changes or reload() is called).
// Pass null to skip loading. The previous data stays on screen while a new request is running.
export function useApiData<T>(path: string | null) {
  const { authedRequest } = useAuth()
  const [data, setData] = useState<T | null>(null)
  // The result of the latest finished request, tagged with the request it belongs to.
  // "loading" is worked out from it, so the effect never has to set state before it starts.
  const [finished, setFinished] = useState<{ key: string; error: string } | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const requestKey = `${path}#${reloadCount}`

  useEffect(() => {
    if (path === null) return
    let cancelled = false
    authedRequest<T>(path)
      .then((reply) => {
        if (cancelled) return
        setData(reply)
        setFinished({ key: requestKey, error: '' })
      })
      .catch((err) => {
        if (!cancelled) setFinished({ key: requestKey, error: errorText(err) })
      })
    return () => {
      cancelled = true
    }
  }, [authedRequest, path, requestKey])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])
  const loading = path !== null && finished?.key !== requestKey
  const error = finished?.key === requestKey ? finished.error : ''
  return { data, error, loading, setData, reload }
}
