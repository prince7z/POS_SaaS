import { Button, HStack, Input, Menu } from '@chakra-ui/react'
import { ChevronDown, Percent } from 'lucide-react'
import type { SaleDiscountType } from '../types'

export function DiscountSelector({
  discountType,
  discountValue,
  onDiscountTypeChange,
  onDiscountValueChange,
}: {
  discountType: SaleDiscountType | null
  discountValue: number
  onDiscountTypeChange: (type: SaleDiscountType | null) => void
  onDiscountValueChange: (value: number) => void
}) {
  const typeLabel = discountType === 'PERCENT' ? '%' : discountType === 'FIXED' ? 'Fixed ($)' : 'None'

  return (
    <HStack gap="2" w="full">
      <Menu.Root positioning={{ placement: 'bottom-start' }}>
        <Menu.Trigger asChild>
          <Button size="sm" variant="outline" flexShrink={0}>
            <Percent size={14} />
            {typeLabel}
            <ChevronDown size={14} />
          </Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content minW="140px">
            <Menu.Item value="none" onClick={() => onDiscountTypeChange(null)}>
              No discount
            </Menu.Item>
            <Menu.Item value="percent" onClick={() => onDiscountTypeChange('PERCENT')}>
              Percentage (%)
            </Menu.Item>
            <Menu.Item value="fixed" onClick={() => onDiscountTypeChange('FIXED')}>
              Fixed Amount
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>

      <Input
        size="sm"
        type="number"
        min="0"
        placeholder={discountType === 'PERCENT' ? 'e.g. 10%' : 'e.g. 5.00'}
        value={discountType ? discountValue : ''}
        disabled={!discountType}
        onChange={(event) => onDiscountValueChange(Math.max(0, Number(event.target.value)))}
        flex="1"
      />
    </HStack>
  )
}
