import type { ReactNode } from 'react'
import { Box } from '@chakra-ui/react'

export function PageContainer({ children }: { children: ReactNode }) {
  return <Box maxW="1280px" mx="auto" w="full" px={{ base: '4', md: '6', lg: '8' }} py={{ base: '6', md: '8' }}>{children}</Box>
}
