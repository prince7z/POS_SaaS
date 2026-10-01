import type { ComponentType } from 'react'
import { Button, Center, Text, VStack } from '@chakra-ui/react'
import { Package } from 'lucide-react'

export function EmptyState({ icon: Icon = Package, title, description, actionLabel, onAction }: { icon?: ComponentType<{ size?: number }>; title: string; description?: string; actionLabel?: string; onAction?: () => void }) {
  return <Center py="16"><VStack gap="3" textAlign="center"><Icon size={28} /><Text fontWeight="600">{title}</Text>{description && <Text color="secondary" textStyle="supporting" maxW="sm">{description}</Text>}{actionLabel && onAction && <Button size="sm" onClick={onAction}>{actionLabel}</Button>}</VStack></Center>
}
