import { Grid, GridItem, HStack, Text, VStack } from '@chakra-ui/react'
import { ArrowDownRight, ArrowUpRight, CreditCard, Package, Receipt, ShoppingBag, TrendingUp } from 'lucide-react'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/formatters'
import type { DashboardKpi } from '../types'
import { AnimatedMetric } from './AnimatedMetric'

const icons = [Receipt, ShoppingBag, TrendingUp, Package, CreditCard]

export function DashboardKpiGrid({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(5, 1fr)' }} gap="3">
      {kpis.map((kpi, index) => {
        const Icon = icons[index] ?? Receipt
        const positive = kpi.change >= 0
        return (
          <GridItem key={kpi.id} borderWidth="1px" borderColor="border" borderRadius="lg" bg="surface" p="4">
            <HStack justify="space-between" align="start">
              <VStack align="start" gap="2">
                <Text fontSize="sm" color="secondary">{kpi.label}</Text>
                <AnimatedMetric value={kpi.value} formatter={kpi.format === 'currency' ? formatCurrency : formatNumber} />
              </VStack>
              <Icon size={18} color="var(--chakra-colors-secondary)" />
            </HStack>
            <HStack mt="3" gap="1" color={positive ? 'success' : 'danger'} fontSize="xs">
              {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <Text fontWeight="600">{formatPercent(kpi.change)}</Text>
              <Text color="secondary">{kpi.comparison}</Text>
            </HStack>
          </GridItem>
        )
      })}
    </Grid>
  )
}
