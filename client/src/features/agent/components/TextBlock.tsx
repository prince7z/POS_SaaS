import { Code, Heading, Text, VStack } from '@chakra-ui/react'
import type { TextBlock as TextBlockType } from '../types/agent'
import { TableBlock } from './TableBlock'

type Chunk =
  | { type: 'header'; level: number; content: string }
  | { type: 'list'; item: string }
  | { type: 'text'; content: string }
  | { type: 'table'; columns: Array<{ key: string; label: string }>; rows: Array<Record<string, string>> }

function formatInlineMarkdown(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g
  const parts = text.split(regex)
  return parts.map((part, index) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <Text as="strong" key={index} fontWeight="bold" color="foreground">
          {part.slice(2, -2)}
        </Text>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <Text as="em" key={index} fontStyle="italic" color="foreground">
          {part.slice(1, -1)}
        </Text>
      )
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <Code key={index} fontSize="xs" px="1" py="0.5" borderRadius="sm">
          {part.slice(1, -1)}
        </Code>
      )
    }
    return part
  })
}

function parseContentChunks(content: string): Chunk[] {
  const lines = content.split('\n')
  const chunks: Chunk[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const headerLine = tableLines[0]
        const headers = headerLine
          .slice(1, -1)
          .split('|')
          .map((h) => h.trim().replace(/\*\*/g, ''))

        const dataLines = tableLines.filter((l) => !l.includes('---'))
        const columns = headers.map((h, idx) => ({ key: `col_${idx}`, label: h }))
        const rows: Record<string, string>[] = []

        for (let dIdx = 1; dIdx < dataLines.length; dIdx++) {
          const cells = dataLines[dIdx]
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim().replace(/\*\*/g, ''))
          const row: Record<string, string> = {}
          columns.forEach((col, cIdx) => {
            row[col.key] = cells[cIdx] || ''
          })
          rows.push(row)
        }

        if (columns.length > 0 && rows.length > 0) {
          chunks.push({ type: 'table', columns, rows })
          continue
        }
      }
    }

    if (trimmed.startsWith('### ')) {
      chunks.push({ type: 'header', level: 3, content: trimmed.slice(4) })
      i++
      continue
    }
    if (trimmed.startsWith('## ')) {
      chunks.push({ type: 'header', level: 2, content: trimmed.slice(3) })
      i++
      continue
    }
    if (trimmed.startsWith('# ')) {
      chunks.push({ type: 'header', level: 1, content: trimmed.slice(2) })
      i++
      continue
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      chunks.push({ type: 'list', item: trimmed.slice(2) })
      i++
      continue
    }

    chunks.push({ type: 'text', content: line })
    i++
  }

  return chunks
}

export function TextBlock({ block }: { block: TextBlockType }) {
  if (!block.content) return null

  const chunks = parseContentChunks(block.content)

  return (
    <VStack align="stretch" gap="1.5" my="1.5">
      {chunks.map((chunk, idx) => {
        if (chunk.type === 'header') {
          const size = chunk.level === 1 ? 'md' : chunk.level === 2 ? 'sm' : 'xs'
          return (
            <Heading key={idx} size={size} fontWeight="bold" color="foreground" mt="2" mb="1">
              {formatInlineMarkdown(chunk.content)}
            </Heading>
          )
        }

        if (chunk.type === 'list') {
          return (
            <Text key={idx} fontSize="xs" color="foreground" pl="3">
              • {formatInlineMarkdown(chunk.item)}
            </Text>
          )
        }

        if (chunk.type === 'table') {
          return (
            <TableBlock
              key={idx}
              block={{
                type: 'table',
                data: { columns: chunk.columns, rows: chunk.rows },
              }}
            />
          )
        }

        return (
          <Text key={idx} fontSize="xs" color="foreground" lineHeight="relaxed">
            {formatInlineMarkdown(chunk.content)}
          </Text>
        )
      })}
    </VStack>
  )
}

