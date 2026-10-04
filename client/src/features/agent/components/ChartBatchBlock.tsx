import { Box, SimpleGrid, Text } from '@chakra-ui/react'
import type { ChartBatchBlock as ChartBatchBlockType } from '../types/agent'
import { buildEChartOption } from './ChartBlock'
import { EChart } from '@/components/charts/EChart'

export function ChartBatchBlock({ block }: { block: ChartBatchBlockType }) {
  const { title, charts } = block

  if (!charts || charts.length === 0) return null

  return (
    <Box p="3" bg="surface" borderWidth="1px" borderRadius="lg" my="2" shadow="sm">
      {title && (
        <Text fontSize="sm" fontWeight="bold" color="foreground" mb="3">
          {title}
        </Text>
      )}
      <SimpleGrid columns={{ base: 1, md: charts.length > 1 ? 2 : 1 }} gap="3">
        {charts.map((chart, idx) => {
          const option = buildEChartOption(chart)
          return (
            <Box key={chart.id || idx} p="2" bg="background" borderRadius="md" borderWidth="1px">
              {chart.title && (
                <Text fontSize="xs" fontWeight="semibold" color="secondary" mb="1.5">
                  {chart.title}
                </Text>
              )}
              <EChart option={option} height="190px" ariaLabel={chart.title || `Batch Chart ${idx + 1}`} />
            </Box>
          )
        })}
      </SimpleGrid>
    </Box>
  )
}
