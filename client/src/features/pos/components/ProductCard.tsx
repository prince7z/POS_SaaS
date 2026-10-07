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
        <ProductImage
          imageUrls={product.imageUrls}
          name={product.name}
          brandName={product.brand?.name}
          sku={product.sku}
        />

        <Card.Body display="flex" flexDirection="column" gap="1" p="2.5" flex="1">
          <Text fontWeight="600" fontSize="xs" lineClamp={2} title={product.name}>
            {product.name}
          </Text>

          {/* Price on Left, Stock Badge on Right - minimal gap under title */}
          <Flex align="center" justify="space-between" gap="1" mt="1">
            <Box minW="0">
              <Text fontWeight="700" fontSize="sm" color="fg.default" lineClamp={1}>
                {formatCurrency(product.sellingPrice)}
              </Text>
              {product.rrp && product.rrp > product.sellingPrice ? (
                <Text as="s" fontSize="10px" color="fg.subtle" display="block" lineHeight="1">
                  {formatCurrency(product.rrp)}
                </Text>
              ) : null}
            </Box>

            <Box flexShrink={0}>
              <StockBadge
                stockQuantity={product.stockQuantity}
                lowStockThreshold={product.lowStockThreshold}
              />
            </Box>
          </Flex>
        </Card.Body>

        <Card.Footer p="2.5" pt="0">
          <Button
            size="xs"
            variant={added ? 'solid' : 'outline'}
            colorPalette={added ? 'green' : undefined}
            disabled={isOutOfStock}
            onClick={() => onAdd(product)}
            w="full"
            fontWeight="600"
          >
            {added ? <Check size={13} /> : <Plus size={13} />}
            {added ? 'Added' : isOutOfStock ? 'Out of stock' : 'Add'}
          </Button>
        </Card.Footer>
      </Card.Root>
    </MotionBox>
  )
}
