import { Badge } from '@chakra-ui/react'
import { humanize } from '@/lib/utils'

type Status = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const statusColor: Record<Status, string> = {
  success: 'green',
  warning: 'orange',
  danger: 'red',
  info: 'blue',
  neutral: 'gray',
}

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <Badge colorPalette={statusColor[status]} variant="subtle">
      {label ?? humanize(status)}
    </Badge>
  )
}
