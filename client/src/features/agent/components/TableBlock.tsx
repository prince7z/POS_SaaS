import { Box, Text } from '@chakra-ui/react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TableBlock as TableBlockType } from '../types/agent'

export function TableBlock({ block }: { block: TableBlockType }) {
  const { data } = block
  const { title, columns = [], rows = [] } = data

  if (columns.length === 0) return null

  return (
    <Box p="3" bg="surface" borderWidth="1px" borderRadius="lg" my="2.5" shadow="sm">
      {title && (
        <Text fontSize="xs" fontWeight="semibold" color="foreground" mb="2">
          {title}
        </Text>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className="text-xs font-semibold">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-xs text-muted-foreground py-4">
                No data available
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rIdx) => (
              <TableRow key={rIdx}>
                {columns.map((col) => (
                  <TableCell key={col.key} className="text-xs py-2">
                    {String(row[col.key] ?? '-')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  )
}
