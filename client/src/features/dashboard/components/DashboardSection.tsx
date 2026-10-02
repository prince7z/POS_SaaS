import type { ReactNode } from 'react'
import { Box, Flex, Heading, Text } from '@chakra-ui/react'

export function DashboardSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="lg" bg="surface" overflow="visible">
      <Flex px={{ base: '4', md: '5' }} py="4" justify="space-between" align="center" gap="4">
        <Box>
          <Heading fontSize="md" fontWeight="600">
            {title}
          </Heading>
          {description && (
            <Text fontSize="sm" color="secondary" mt="1">
              {description}
            </Text>
          )}
        </Box>
        {action}
      </Flex>
      {children}
    </Box>
  )
}
