import { Flex } from '@chakra-ui/react'
import { Sparkles } from 'lucide-react'

export function AiAvatar({ size = 28 }: { size?: number }) {
  return (
    <Flex
      w={`${size}px`}
      h={`${size}px`}
      borderRadius="full"
      align="center"
      justify="center"
      shrink={0}
      color="#FFFFFF"
      bg="#2563EB"
      boxShadow="0 1px 3px rgba(37, 99, 235, 0.35)"
      aria-hidden
    >
      <Sparkles size={Math.round(size * 0.55)} strokeWidth={2.2} />
    </Flex>
  )
}
