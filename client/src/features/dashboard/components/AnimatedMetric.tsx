import { useEffect, useState } from 'react'
import { Text } from '@chakra-ui/react'
import { animate, useMotionValue } from 'motion/react'

export function AnimatedMetric({ value, formatter }: { value: number | null; formatter: (value: number) => string }) {
  const motionValue = useMotionValue(value ?? 0)
  const [displayValue, setDisplayValue] = useState(value ?? 0)

  useEffect(() => {
    const controls = animate(motionValue, value ?? 0, {
      duration: 0.35,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayValue(latest),
    })
    return () => controls.stop()
  }, [motionValue, value])

  return (
    <Text fontSize="xl" fontWeight="700" letterSpacing="-0.02em">
      {value === null ? '—' : formatter(displayValue)}
    </Text>
  )
}
