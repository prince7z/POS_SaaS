import { Box, HStack, Image, Text, VStack } from '@chakra-ui/react'
import type { InventoryItem } from '@/api/endpoints/inventory'

export function InventoryProductImage({ product, size = '40px' }: { product: Pick<InventoryItem, 'name' | 'imageUrls'>; size?: string }) {
  return product.imageUrls?.[0]
    ? <Image src={product.imageUrls[0]} alt={product.name} boxSize={size} objectFit="cover" borderRadius="md" flexShrink={0} />
    : <Box boxSize={size} borderRadius="md" bg="background" display="grid" placeItems="center" flexShrink={0}><Text fontSize="sm" fontWeight="700" color="secondary">{product.name.slice(0, 1).toUpperCase()}</Text></Box>
}

export function InventoryProductIdentity({ product, compact = false }: { product: InventoryItem; compact?: boolean }) {
  return <HStack align="center" gap="3"><InventoryProductImage product={product} size={compact ? '36px' : '44px'} /><VStack align="start" gap="0" minW="0"><Text fontWeight="600" lineClamp={1}>{product.name}</Text><Text fontSize="xs" color="secondary">{product.sku}{product.brand?.name ? ` · ${product.brand.name}` : ''}</Text></VStack></HStack>
}

export function InventoryProductDetails({ product }: { product: InventoryItem }) {
  return <HStack align="start" gap="4"><InventoryProductImage product={product} size="84px" /><VStack align="start" gap="1" minW="0"><Text fontWeight="700">{product.name}</Text><Text fontSize="sm" color="secondary">{product.description || 'No product description available.'}</Text><Text fontSize="xs" color="secondary">SKU: {product.sku}{product.barcode ? ` · Barcode: ${product.barcode}` : ''}</Text><Text fontSize="xs" color="secondary">Category: {product.category?.name ?? 'Uncategorized'} · Brand: {product.brand?.name ?? 'No brand'} · Supplier: {product.supplier?.name ?? 'No supplier'}</Text></VStack></HStack>
}
