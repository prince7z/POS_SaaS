import type { ReactNode } from 'react'
import { Flex, Heading, Text, VStack } from '@chakra-ui/react'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap="4" mb="8" direction={{ base: 'column', md: 'row' }}>
      <VStack align="start" gap="1"><Heading textStyle="pageTitle">{title}</Heading>{description && <Text textStyle="supporting" color="secondary">{description}</Text>}</VStack>
      {actions && <Flex gap="2">{actions}</Flex>}
    </Flex>
  )
}
