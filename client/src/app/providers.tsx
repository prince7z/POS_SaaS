import type { ReactNode } from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter } from 'react-router-dom'
import { system } from '@/theme'
import { AppToaster } from '@/components/feedback/AppToaster'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <BrowserRouter>
        {children}
        <AppToaster />
      </BrowserRouter>
    </ChakraProvider>
  )
}
