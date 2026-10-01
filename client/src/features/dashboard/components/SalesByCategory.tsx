import { Box, Flex, HStack, Text, VStack } from '@chakra-ui/react'
import type { EChartsOption } from 'echarts'
import { EChart } from '@/components/charts/EChart'
import { formatCurrency } from '@/lib/formatters'
import { getChartThemeTokens } from '../chartTheme'
import type { CategorySale } from '../types'
import { DashboardSection } from './DashboardSection'

export function SalesByCategory({ categories }: { categories: CategorySale[] }) {
  const theme = getChartThemeTokens()
  const option: EChartsOption = {
    animation: true,
    color: theme.categories,
    tooltip: { trigger: 'item', renderMode: 'html', appendToBody: true, confine: false, formatter: (params) => {
      const item = params as { name?: string; value?: number | string; percent?: number }
      return `${item.name ?? ''}<br/>${formatCurrency(Number(item.value ?? 0))} (${item.percent ?? 0}%)`
    } },
    series: [{ type: 'pie', radius: ['52%', '76%'], center: ['50%', '50%'], label: { show: false }, emphasis: { scale: true, scaleSize: 4 }, data: categories.map((item) => ({ name: item.category, value: item.sales })) }],
  }

  return (
    <DashboardSection title="Sales by Category" description="Where sales are coming from.">
      <Flex direction={{ base: 'column', md: 'row' }} align="center" gap={{ base: '3', md: '5' }} px={{ base: '3', md: '4' }} pb="5">
        <Box flex={{ base: '0 0 auto', md: '0 0 190px' }} w={{ base: 'full', md: '190px' }} maxW="full"><EChart option={option} height="210px" ariaLabel="Sales by category donut chart" /></Box>
        <VStack align="stretch" gap="2.5" flex="1" minW="0" w="full">
          {categories.map((item, index) => <HStack key={item.category} justify="space-between" fontSize="sm"><HStack gap="2"><Box w="8px" h="8px" borderRadius="full" bg={theme.categories[index % theme.categories.length]} /><Text>{item.category}</Text></HStack><Text color="secondary">{formatCurrency(item.sales)}</Text></HStack>)}
        </VStack>
      </Flex>
    </DashboardSection>
  )
}
