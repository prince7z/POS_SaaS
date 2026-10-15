import { useEffect, useRef, useState } from 'react'
import { Button, Flex, Grid, Popover, Text } from '@chakra-ui/react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'

export type TakealotDateRange = { from: string; to: string }

type Preset = { label: string; getRange: (today: Date) => TakealotDateRange }

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
const shiftMonth = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1)
const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
const rangeFrom = (first: string, second: string): TakealotDateRange =>
  first <= second ? { from: first, to: second } : { from: second, to: first }
const formatDate = (value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  new Intl.DateTimeFormat(undefined, options).format(parseDate(value))
const sameRange = (first: TakealotDateRange, second: TakealotDateRange) =>
  first.from === second.from && first.to === second.to

const presets: Preset[] = [
  { label: 'Today', getRange: (today) => ({ from: dateKey(today), to: dateKey(today) }) },
  { label: 'Yesterday', getRange: (today) => ({ from: dateKey(addDays(today, -1)), to: dateKey(addDays(today, -1)) }) },
  { label: 'Last 7 days', getRange: (today) => ({ from: dateKey(addDays(today, -6)), to: dateKey(today) }) },
  { label: 'Last 30 days', getRange: (today) => ({ from: dateKey(addDays(today, -29)), to: dateKey(today) }) },
  { label: 'Last 90 days', getRange: (today) => ({ from: dateKey(addDays(today, -89)), to: dateKey(today) }) },
  {
    label: 'This month',
    getRange: (today) => ({ from: dateKey(monthStart(today)), to: dateKey(today) }),
  },
  {
    label: 'Previous month',
    getRange: (today) => {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      return { from: dateKey(start), to: dateKey(new Date(today.getFullYear(), today.getMonth(), 0)) }
    },
  },
  {
    label: 'Last 6 months',
    getRange: (today) => ({ from: dateKey(new Date(today.getFullYear(), today.getMonth() - 5, 1)), to: dateKey(today) }),
  },
]

function MonthCalendar({
  month,
  side,
  range,
  today,
  onNavigate,
  onDatePointerDown,
  onDatePointerEnter,
  onDateClick,
}: {
  month: Date
  side: 'previous' | 'next'
  range: TakealotDateRange
  today: string
  onNavigate: (months: number) => void
  onDatePointerDown: (date: string) => void
  onDatePointerEnter: (date: string) => void
  onDateClick: (date: string, detail: number) => void
}) {
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)
  const firstDay = monthStart(month)
  const gridStart = addDays(firstDay, -firstDay.getDay())
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const cellCount = Math.ceil((firstDay.getDay() + lastDay.getDate()) / 7) * 7
  const days = Array.from({ length: cellCount }, (_, index) => addDays(gridStart, index))
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div aria-label={monthName}>
      <Flex align="center" justify="space-between" mb="3">
        {side === 'previous' ? (
          <Button size="xs" variant="ghost" aria-label="Show previous month" onClick={() => onNavigate(-1)}>
            <ChevronLeft size={16} />
          </Button>
        ) : <span />}
        <Text fontSize="sm" fontWeight="700">{monthName}</Text>
        {side === 'next' ? (
          <Button size="xs" variant="ghost" aria-label="Show next month" onClick={() => onNavigate(1)}>
            <ChevronRight size={16} />
          </Button>
        ) : <span />}
      </Flex>
      <Grid templateColumns="repeat(7, minmax(0, 1fr))" gap="1" mb="1">
        {weekdays.map((weekday) => (
          <Text key={weekday} textAlign="center" fontSize="xs" color="fg.muted" py="1">
            {weekday}
          </Text>
        ))}
      </Grid>
      <Grid templateColumns="repeat(7, minmax(0, 1fr))" gap="1">
        {days.map((date) => {
          const value = dateKey(date)
          const selected = value === range.from || value === range.to
          const inRange = value >= range.from && value <= range.to
          const inMonth = date.getMonth() === month.getMonth()
          const isToday = value === today
          return (
            <Button
              key={value}
              size="xs"
              variant="ghost"
              aria-label={formatDate(value, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              aria-pressed={selected}
              disabled={value > today}
              onPointerDown={() => onDatePointerDown(value)}
              onPointerEnter={() => onDatePointerEnter(value)}
              onClick={(event) => onDateClick(value, event.detail)}
              bg={selected ? 'blue.600' : inRange ? 'blue.50' : 'transparent'}
              color={selected ? 'white' : !inMonth || value > today ? 'fg.subtle' : 'fg'}
              borderRadius={selected ? 'md' : 'sm'}
              outline={isToday && !selected ? '1px solid' : undefined}
              outlineColor={isToday && !selected ? 'blue.400' : undefined}
              _hover={{ bg: selected ? 'blue.700' : inRange ? 'blue.100' : 'bg.muted' }}
              _disabled={{ opacity: 0.45, cursor: 'not-allowed' }}
              minW="0"
              w="100%"
              h="9"
              fontWeight={selected || isToday ? '700' : '500'}
            >
              {date.getDate()}
            </Button>
          )
        })}
      </Grid>
    </div>
  )
}

export function TakealotDateRangePicker({
  value,
  onApply,
}: {
  value: TakealotDateRange
  onApply: (range: TakealotDateRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [pendingRange, setPendingRange] = useState(value)
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(parseDate(value.from)))
  const [error, setError] = useState('')
  const anchor = useRef<string | null>(null)
  const selecting = useRef(false)
  const dragging = useRef(false)
  const today = dateKey(new Date())

  useEffect(() => {
    const stopDragging = () => {
      dragging.current = false
    }
    window.addEventListener('pointerup', stopDragging)
    return () => window.removeEventListener('pointerup', stopDragging)
  }, [])

  const startPicking = (date: string) => {
    if (anchor.current) {
      setPendingRange(rangeFrom(anchor.current, date))
      anchor.current = null
      selecting.current = false
      return
    }
    anchor.current = date
    selecting.current = true
    setPendingRange({ from: date, to: date })
  }

  const handlePointerDown = (date: string) => {
    if (date > today) return
    dragging.current = true
    startPicking(date)
  }

  const handlePointerEnter = (date: string) => {
    if (dragging.current && selecting.current && anchor.current && date <= today) {
      setPendingRange(rangeFrom(anchor.current, date))
    }
  }

  const apply = () => {
    if (!pendingRange.from || !pendingRange.to || pendingRange.from > pendingRange.to || pendingRange.to > today) {
      setError('Choose a valid date range ending today or earlier.')
      return
    }
    setError('')
    anchor.current = null
    selecting.current = false
    onApply(pendingRange)
    setOpen(false)
  }

  const rangeLabel = `${formatDate(value.from)} – ${formatDate(value.to)}`

  return (
    <Popover.Root
      open={open}
      onOpenChange={(event) => {
        setOpen(event.open)
        if (event.open) {
          setPendingRange(value)
          setVisibleMonth(monthStart(parseDate(value.from)))
          setError('')
          anchor.current = null
          selecting.current = false
        }
      }}
    >
      <Popover.Trigger asChild>
        <Button
          size="sm"
          variant="outline"
          aria-label={`Choose date range, currently ${rangeLabel}`}
          aria-haspopup="dialog"
          minH="10"
          px="3"
        >
          <CalendarDays size={15} aria-hidden="true" />
          <span>{rangeLabel}</span>
        </Button>
      </Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content
          width={{ base: 'calc(100vw - 24px)', md: '680px' }}
          maxH="min(85vh, 720px)"
          overflowY="auto"
          p="0"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          boxShadow="xl"
          zIndex="popover"
        >
          <Flex align="center" justify="space-between" px="5" py="4" borderBottomWidth="1px" borderColor="border">
            <div>
              <Text fontSize="sm" fontWeight="700">Select date range</Text>
              <Text fontSize="xs" color="fg.muted" mt="1">{formatDate(pendingRange.from)} – {formatDate(pendingRange.to)}</Text>
            </div>
            <Button size="xs" variant="ghost" aria-label="Close date picker" onClick={() => setOpen(false)}>
              <span aria-hidden="true">×</span>
            </Button>
          </Flex>
          <Grid templateColumns={{ base: '1fr', md: '150px minmax(0, 1fr)' }}>
            <Flex
              direction={{ base: 'row', md: 'column' }}
              gap="1"
              p="3"
              borderRightWidth={{ base: '0', md: '1px' }}
              borderBottomWidth={{ base: '1px', md: '0' }}
              borderColor="border"
              overflowX="auto"
            >
              {presets.map((preset) => {
                const presetRange = preset.getRange(parseDate(today))
                const selected = sameRange(presetRange, pendingRange)
                return (
                  <Button
                    key={preset.label}
                    size="sm"
                    variant={selected ? 'subtle' : 'ghost'}
                    colorPalette={selected ? 'blue' : undefined}
                    justifyContent={{ base: 'center', md: 'flex-start' }}
                    whiteSpace="nowrap"
                    onClick={() => {
                      setPendingRange(presetRange)
                      setVisibleMonth(monthStart(parseDate(presetRange.from)))
                      setError('')
                      anchor.current = null
                      selecting.current = false
                    }}
                  >
                    {preset.label}
                  </Button>
                )
              })}
            </Flex>
            <div>
              <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={{ base: '4', md: '5' }} p={{ base: '3', md: '5' }}>
                <MonthCalendar
                  month={visibleMonth}
                  side="previous"
                  range={pendingRange}
                  today={today}
                  onNavigate={(months) => months && setVisibleMonth((current) => shiftMonth(current, months))}
                  onDatePointerDown={handlePointerDown}
                  onDatePointerEnter={handlePointerEnter}
                  onDateClick={(date, detail) => {
                    if (detail === 0) startPicking(date)
                  }}
                />
                <MonthCalendar
                  month={shiftMonth(visibleMonth, 1)}
                  side="next"
                  range={pendingRange}
                  today={today}
                  onNavigate={(months) => months && setVisibleMonth((current) => shiftMonth(current, months))}
                  onDatePointerDown={handlePointerDown}
                  onDatePointerEnter={handlePointerEnter}
                  onDateClick={(date, detail) => {
                    if (detail === 0) startPicking(date)
                  }}
                />
              </Grid>
              {error && <Text role="alert" color="fg.error" fontSize="xs" px="5" pb="3">{error}</Text>}
            </div>
          </Grid>
          <Flex align="center" justify="space-between" gap="2" px="4" py="3" borderTopWidth="1px" borderColor="border" wrap="wrap">
            <Flex gap="2" wrap="wrap">
              <Button size="sm" variant="outline" onClick={() => setVisibleMonth((month) => shiftMonth(month, -6))}>
                <ChevronLeft size={14} /> Back 6 months
              </Button>
              <Button size="sm" variant="outline" onClick={() => setVisibleMonth((month) => shiftMonth(month, 6))}>
                Forward 6 months <ChevronRight size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const resetRange = presets[3].getRange(parseDate(today))
                  setPendingRange(resetRange)
                  setVisibleMonth(monthStart(parseDate(resetRange.from)))
                  setError('')
                  anchor.current = null
                  selecting.current = false
                }}
              >
                <RotateCcw size={14} /> Reset
              </Button>
            </Flex>
            <Button size="sm" colorPalette="blue" onClick={apply}>
              <Check size={14} /> Apply range
            </Button>
          </Flex>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  )
}
