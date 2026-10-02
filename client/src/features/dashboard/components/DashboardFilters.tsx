import { useState } from 'react'
import { Button, HStack, Input, Popover, Text, VStack } from '@chakra-ui/react'
import { CalendarDays, Check } from 'lucide-react'
import type { DashboardCustomRange, DashboardRange } from '../types'

const presets: Array<{ value: DashboardRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
]

export function DashboardFilters({
  value,
  customRange,
  onChange,
  onCustomRangeChange,
}: {
  value: DashboardRange
  customRange: DashboardCustomRange | null
  onChange: (range: DashboardRange) => void
  onCustomRangeChange: (range: DashboardCustomRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(customRange?.from ?? '')
  const [to, setTo] = useState(customRange?.to ?? '')
  const [error, setError] = useState('')

  const applyCustomRange = () => {
    if (!from || !to || from > to) {
      setError('Choose a valid date range.')
      return
    }
    setError('')
    onCustomRangeChange({ from, to })
    setOpen(false)
  }

  return (
    <HStack
      role="group"
      aria-label="Dashboard date range"
      gap="1"
      wrap="wrap"
      p="1"
      bg="rgba(17, 24, 39, 0.04)"
      borderWidth="1px"
      borderColor="border"
      borderRadius="lg"
    >
      {presets.map((preset) => {
        const selected = value === preset.value
        return (
          <Button
            key={preset.value}
            size="sm"
            variant={selected ? 'solid' : 'ghost'}
            colorPalette={selected ? 'blue' : undefined}
            aria-pressed={selected}
            onClick={() => onChange(preset.value)}
            position="relative"
            minH="32px"
            px={{ base: '2', md: '3' }}
            fontSize="xs"
            fontWeight={selected ? '700' : '600'}
            whiteSpace="nowrap"
            transition="background 160ms ease, color 160ms ease, transform 160ms ease"
            _active={{ transform: 'scale(0.98)' }}
          >
            {preset.label}
          </Button>
        )
      })}
      <Popover.Root open={open} onOpenChange={(event) => setOpen(event.open)}>
        <Popover.Trigger asChild>
          <Button
            size="sm"
            variant={value === 'custom' ? 'solid' : 'ghost'}
            colorPalette={value === 'custom' ? 'blue' : undefined}
            aria-label="Choose custom date range"
            aria-pressed={value === 'custom'}
            minH="32px"
            px="2"
          >
            <CalendarDays size={15} />
            <Text display={{ base: 'none', md: 'block' }}>Custom</Text>
          </Button>
        </Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content width="280px">
            <Popover.Body>
              <VStack align="stretch" gap="3">
                <Text fontSize="sm" fontWeight="700">
                  Choose date range
                </Text>
                <Input
                  aria-label="From date"
                  type="date"
                  size="sm"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
                <Input
                  aria-label="To date"
                  type="date"
                  size="sm"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
                {error && (
                  <Text fontSize="xs" color="danger">
                    {error}
                  </Text>
                )}
                <Button size="sm" colorPalette="blue" onClick={applyCustomRange}>
                  <Check size={14} />
                  Apply range
                </Button>
              </VStack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>
    </HStack>
  )
}
