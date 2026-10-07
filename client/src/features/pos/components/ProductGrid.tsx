import { Box, SimpleGrid } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import type { CatalogProduct } from '@/api/endpoints/catalog'
import { ProductCard } from './ProductCard'

const MotionBox = motion.create(Box)

export function ProductGrid({
  products,
  addedProductId,
  onAdd,
}: {
  products: CatalogProduct[]
  addedProductId: string | null
  onAdd: (product: CatalogProduct) => void
}) {
  return (
    <AnimatePresence mode="popLayout">
      <SimpleGrid
        mt="3"
        columns={{ base: 1, sm: 2, md: 3, xl: 4 }}
        gap="3"
      >
        {products.map((product) => (
          <MotionBox
            key={product.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ProductCard
              product={product}
              added={addedProductId === product.id}
              onAdd={onAdd}
            />
          </MotionBox>
        ))}
      </SimpleGrid>
    </AnimatePresence>
  )
}
