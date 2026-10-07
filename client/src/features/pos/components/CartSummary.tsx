import { HStack, Separator, Text, VStack } from '@chakra-ui/react'
import { motion, useReducedMotion } from 'motion/react'
import { formatCurrency } from '@/lib/formatters'
import type { SaleTotals } from '../types'

export function CartSummary({ totals }: { totals: SaleTotals }) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <VStack align="stretch" gap="2" pt="2">
      <HStack justify="space-between" fontSize="sm">
        <Text color="fg.subtle">Subtotal</Text>
        <Text fontWeight="500">{formatCurrency(totals.subtotal)}</Text>
      </HStack>
      {totals.discount > 0 && (
        <HStack justify="space-between" fontSize="sm">
          <Text color="fg.subtle">Discount</Text>
          <Text fontWeight="500" color="red.500">
            -{formatCurrency(totals.discount)}
          </Text>
        </HStack>
      )}
      <HStack justify="space-between" fontSize="sm">
        <Text color="fg.subtle">Tax</Text>
        <Text fontWeight="500">{formatCurrency(totals.tax)}</Text>
      </HStack>
      <Separator />
      <HStack justify="space-between" fontWeight="700" fontSize="lg" pt="1">
        <Text>Total</Text>
        <motion.span
          key={totals.total}
          initial={prefersReducedMotion ? false : { opacity: 0.5, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {formatCurrency(totals.total)}
        </motion.span>
      </HStack>
    </VStack>
  )
}
