import { Box, Flex, IconButton, Image, Text, VStack } from '@chakra-ui/react'
import { motion } from 'motion/react'
import { ImageOff, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import type { CartItem as CartItemType } from '../types'
import { CartQuantityControl } from './CartQuantityControl'

const MotionBox = motion.create(Box)

export function CartItem({
  item,
  onQuantity,
  onRemove,
}: {
  item: CartItemType
  onQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  const imageUrl = item.imageUrls?.[0]

  return (
    <MotionBox
      layout
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      overflow="hidden"
    >
      <Flex align="start" gap="2.5" py="2.5" borderBottomWidth="1px" borderColor="border">
        {/* Square Mini-thumbnail */}
        <Box
          w="42px"
          h="42px"
          borderRadius="sm"
          bg="bg.subtle"
          overflow="hidden"
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink="0"
          borderWidth="1px"
          borderColor="border"
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={item.name}
              w="full"
              h="full"
              fit="contain"
              loading="lazy"
            />
          ) : (
            <ImageOff size={16} style={{ opacity: 0.4 }} />
          )}
        </Box>

        {/* Info & Quantity controls */}
        <Box flex="1" minW="0">
          <Text fontSize="sm" fontWeight="600" lineClamp={1} title={item.name}>
            {item.name}
          </Text>
          <Text fontSize="xs" color="fg.subtle">
            {formatCurrency(item.sellingPrice)} each
          </Text>

          <Box mt="1.5">
            <CartQuantityControl
              quantity={item.quantity}
              maxStock={item.stockQuantity}
              onQuantityChange={onQuantity}
            />
          </Box>
        </Box>

        {/* Line Total & Remove */}
        <VStack align="end" gap="1">
          <Text fontWeight="600" fontSize="sm" color="fg.default">
            {formatCurrency(item.sellingPrice * item.quantity)}
          </Text>
          <IconButton
            aria-label={`Remove ${item.name}`}
            size="xs"
            variant="ghost"
            colorPalette="red"
            onClick={onRemove}
          >
            <Trash2 size={14} />
          </IconButton>
        </VStack>
      </Flex>
    </MotionBox>
  )
}
