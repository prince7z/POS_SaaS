import { useEffect } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { consumeStashedToast } from './notifications'

export function AppToaster() {
  useEffect(() => {
    consumeStashedToast()
  }, [])

  return <Toaster />
}
