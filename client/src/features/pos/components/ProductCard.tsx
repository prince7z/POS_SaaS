import { Box, Button, Card, Flex, Text } from '@chakra-ui/react'
import { Check, Plus } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { formatCurrency } from '@/lib/formatters'
import type { CatalogProduct } from '@/api/endpoints/catalog'
import { ProductImage } from './ProductImage'
import { StockBadge } from './StockBadge'

const MotionBox = motion.create(Box)

export function ProductCard({
  product,
  added,
  onAdd,
}: {
  product: CatalogProduct
  added: boolean
  onAdd: (product: CatalogProduct) => void
}) {
  const prefersReducedMotion = useReducedMotion()
  const isOutOfStock = product.stockQuantity <= 0

  return (
    <MotionBox
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.15 }}
      h="full"
    >
      <Card.Root
        variant="outline"
        size="sm"
        h="full"
        borderRadius="sm"
        overflow="hidden"
        display="flex"
        flexDirection="column"
        bg="bg.panel"
      >
        <ProductImage imageUrls={product.imageUrls} name={product.name} />

        <Card.Body display="flex" flexDirection="column" gap="1.5" p="3" flex="1">
          <Text fontSize="xs" color="fg.subtle" lineClamp={1}>
            {product.brand?.name ?? '—'}
          </Text>

          <Text fontWeight="600" fontSize="sm" lineClamp={2} title={product.name} minH="2.5em">
            {product.name}
          </Text>

          <Text fontSize="xs" color="fg.muted">
            SKU: {product.sku}
          </Text>

          <Flex align="baseline" gap="2" mt="auto" pt="1">
            <Text fontWeight="700" fontSize="md" color="fg.default">
              {formatCurrency(product.sellingPrice)}
            </Text>
            {product.rrp && product.rrp > product.sellingPrice ? (
              <Text as="s" fontSize="xs" color="fg.subtle">
                {formatCurrency(product.rrp)}
              </Text>
            ) : null}
          </Flex>

          <Box mt="0.5">
            <StockBadge
              stockQuantity={product.stockQuantity}
              lowStockThreshold={product.lowStockThreshold}
            />
          </Box>
        </Card.Body>

        <Card.Footer p="3" pt="0">
          <Button
            size="sm"
            variant={added ? 'solid' : 'outline'}
            colorPalette={added ? 'green' : undefined}
            disabled={isOutOfStock}
            onClick={() => onAdd(product)}
            w="full"
          >
            {added ? <Check size={14} /> : <Plus size={14} />}
            {added ? 'Added' : isOutOfStock ? 'Out of stock' : 'Add'}
          </Button>
        </Card.Footer>
      </Card.Root>
    </MotionBox>
  )
}
