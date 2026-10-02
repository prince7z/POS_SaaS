import { Box, Button, Card, Flex, Text } from '@chakra-ui/react'
import { Check, Image as ImageIcon, Plus } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { CatalogProduct } from '@/api/endpoints/catalog'

const MotionBox = motion.create(Box)

interface ProductCard12Props {
  product: CatalogProduct
  added: boolean
  onAdd: (product: CatalogProduct) => void
}

export function ProductCard12({ product, added, onAdd }: ProductCard12Props) {
  const prefersReducedMotion = useReducedMotion()
  const imageUrl = product.imageKeys[0]
  const outOfStock = product.stockQuantity <= 0
  const lowStock = !outOfStock && product.stockQuantity <= product.lowStockThreshold

  return (
    <MotionBox whileHover={prefersReducedMotion ? undefined : { y: -2 }} transition={{ duration: 0.16 }} h="full">
      <Card.Root variant="outline" size="sm" h="full" borderRadius="sm" overflow="hidden">
        <Card.Body display="flex" flexDirection="column" gap="2" p="3">
          <Box h="84px" bg="background" borderRadius="sm" overflow="hidden" display="grid" placeItems="center">
            {imageUrl ? <img src={imageUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ImageIcon size={24} color="var(--chakra-colors-muted)" />}
          </Box>
          <Box flex="1" minW="0">
            <Text fontSize="xs" color="secondary" lineClamp={1}>{product.brand?.name ?? 'Unbranded'}</Text>
            <Text fontFamily="heading" fontWeight="600" lineClamp={2}>{product.name}</Text>
            <Text fontSize="xs" color="secondary" mt="0.5">{product.sku}</Text>
          </Box>
          <Flex justify="space-between" align="end" gap="2">
            <Box>
              <Text fontWeight="700">${product.sellingPrice.toFixed(2)}</Text>
              <Text fontSize="xs" color={outOfStock ? 'danger' : lowStock ? 'warning' : 'secondary'}>
                {outOfStock ? 'Out of stock' : lowStock ? `${product.stockQuantity} left` : `${product.stockQuantity} in stock`}
              </Text>
            </Box>
            <Button size="sm" variant={added ? 'solid' : 'outline'} colorPalette={added ? 'success' : undefined} disabled={outOfStock} onClick={() => onAdd(product)}>
              {added ? <Check size={14} /> : <Plus size={14} />}
              {added ? 'Added' : 'Add'}
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>
    </MotionBox>
  )
}