import { Flex, NativeSelect, Text } from '@chakra-ui/react'

export function PageSizeControl({
  value,
  onChange,
}: {
  value: number
  onChange: (limit: number) => void
}) {
  return (
    <Flex align="center" gap="2" flexShrink="0">
      <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">Rows per page</Text>
      <NativeSelect.Root size="sm" w="84px">
        <NativeSelect.Field
          aria-label="Rows per page (maximum 100)"
          value={value}
          onChange={(event) => {
            const limit = Number(event.target.value)
            if (Number.isInteger(limit) && limit >= 1 && limit <= 100) onChange(limit)
          }}
        >
          {[10, 20, 50, 100].map((limit) => (
            <option key={limit} value={limit}>{limit}</option>
          ))}
        </NativeSelect.Field>
      </NativeSelect.Root>
    </Flex>
  )
}
