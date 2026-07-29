import { useEffect, useRef } from 'react'
import api from '../services/api'

const STORAGE_KEY = 'zenith_app_commit'
const CHECK_INTERVAL = 60_000 // 60 secondes

export function useVersionCheck() {
  const lastCommitRef = useRef<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    lastCommitRef.current = stored

    const checkVersion = async () => {
      try {
        const res = await api.get('/version/')
        const commit = res.data.commit as string | null
        if (!commit) return

        if (lastCommitRef.current === null) {
          lastCommitRef.current = commit
          localStorage.setItem(STORAGE_KEY, commit)
          return
        }

        if (lastCommitRef.current !== commit) {
          localStorage.setItem(STORAGE_KEY, commit)
          window.location.reload()
        }
      } catch {
        // Backend injoignable — retry au prochain intervalle
      }
    }

    const interval = setInterval(checkVersion, CHECK_INTERVAL)
    return () => clearInterval(interval)
  }, [])
}
