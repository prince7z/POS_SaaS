import { Button, HStack } from '@chakra-ui/react'
import { Banknote, CreditCard, Wallet } from 'lucide-react'
import type { SalePaymentMethod } from '../types'

export function PaymentMethodSelector({
  value,
  onChange,
}: {
  value: SalePaymentMethod
  onChange: (method: SalePaymentMethod) => void
}) {
  const methods: Array<[SalePaymentMethod, string, typeof Banknote]> = [
    ['CASH', 'Cash', Banknote],
    ['CARD', 'Card', CreditCard],
    ['STORE_CREDIT', 'Store Credit', Wallet],
  ]

  return (
    <HStack gap="1.5" w="full">
      {methods.map(([method, label, Icon]) => {
        const isSelected = value === method
        return (
          <Button
            key={method}
            size="sm"
            flex="1"
            variant={isSelected ? 'solid' : 'outline'}
            colorPalette={isSelected ? 'blue' : undefined}
            onClick={() => onChange(method)}
          >
            <Icon size={14} />
            {label}
          </Button>
        )
      })}
    </HStack>
  )
}
