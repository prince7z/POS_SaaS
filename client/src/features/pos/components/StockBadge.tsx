import { Badge } from '@chakra-ui/react'

export function StockBadge({
  stockQuantity,
  lowStockThreshold,
}: {
  stockQuantity: number
  lowStockThreshold: number
}) {
  const isOutOfStock = stockQuantity <= 0
  const isLowStock = !isOutOfStock && stockQuantity <= lowStockThreshold

  if (isOutOfStock) {
    return (
      <Badge size="sm" variant="subtle" colorPalette="red">
        Out of stock
      </Badge>
    )
  }

  if (isLowStock) {
    return (
      <Badge size="sm" variant="subtle" colorPalette="orange">
        Low stock ({stockQuantity})
      </Badge>
    )
  }

  return (
    <Badge size="sm" variant="subtle" colorPalette="green">
      In stock ({stockQuantity})
    </Badge>
  )
}
