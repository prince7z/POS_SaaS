import { Box, HStack, IconButton, Input } from '@chakra-ui/react'
import { Barcode, Search, X } from 'lucide-react'

export function ProductSearch({
  value,
  onChange,
  onBarcodeScan,
}: {
  value: string
  onChange: (value: string) => void
  onBarcodeScan?: () => void
}) {
  return (
    <HStack gap="2" w="full">
      <Box position="relative" flex="1">
        <Box
          position="absolute"
          left="3"
          top="50%"
          transform="translateY(-50%)"
          color="fg.muted"
          pointerEvents="none"
          display="flex"
          alignItems="center"
          zIndex="1"
        >
          <Search size={16} />
        </Box>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search products by name, SKU or barcode…"
          pl="9"
          pr={value ? '9' : '3'}
          size="sm"
          borderRadius="sm"
          bg="bg.panel"
        />
        {value && (
          <IconButton
            aria-label="Clear search"
            size="xs"
            variant="ghost"
            position="absolute"
            right="1.5"
            top="50%"
            transform="translateY(-50%)"
            onClick={() => onChange('')}
          >
            <X size={14} />
          </IconButton>
        )}
      </Box>

      {onBarcodeScan && (
        <IconButton
          size="sm"
          variant="outline"
          aria-label="Scan barcode"
          title="Scan barcode"
          onClick={onBarcodeScan}
          borderRadius="sm"
          flexShrink={0}
        >
          <Barcode size={17} />
        </IconButton>
      )}
    </HStack>
  )
}
