import type { ReactNode } from 'react'
import { Box } from '@chakra-ui/react'

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Box className={className} w="full" minW="0" px={{ base: '4', md: '6', lg: '8' }} py={{ base: '5', md: '7' }}>
      {children}
    </Box>
  )
}
