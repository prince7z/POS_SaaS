import { HStack, IconButton, Text } from '@chakra-ui/react'
import { Minus, Plus } from 'lucide-react'

export function CartQuantityControl({
  quantity,
  maxStock,
  onQuantityChange,
}: {
  quantity: number
  maxStock: number
  onQuantityChange: (newQuantity: number) => void
}) {
  return (
    <HStack gap="1" align="center">
      <IconButton
        aria-label="Decrease quantity"
        size="xs"
        variant="outline"
        onClick={() => onQuantityChange(quantity - 1)}
        disabled={quantity <= 1}
        borderRadius="xs"
      >
        <Minus size={12} />
      </IconButton>
      <Text minW="6" textAlign="center" fontSize="sm" fontWeight="600">
        {quantity}
      </Text>
      <IconButton
        aria-label="Increase quantity"
        size="xs"
        variant="outline"
        onClick={() => onQuantityChange(quantity + 1)}
        disabled={quantity >= maxStock}
        borderRadius="xs"
      >
        <Plus size={12} />
      </IconButton>
    </HStack>
  )
}
