import { useState } from 'react'
import { Box, Image, Text } from '@chakra-ui/react'
import { ImageOff } from 'lucide-react'

export function ProductImage({
  imageUrls,
  name,
  brandName,
  sku,
}: {
  imageUrls?: string[] | null
  name: string
  brandName?: string | null
  sku: string
}) {
  const [imageError, setImageError] = useState(false)
  const imageUrl = imageUrls?.[0]

  return (
    <Box
      aspectRatio="1"
      overflow="hidden"
      position="relative"
      bg="bg.subtle"
      borderRadius="sm"
      display="flex"
      alignItems="center"
      justifyContent="center"
      borderBottomWidth="1px"
      borderColor="border"
    >
      {/* Brand Name & SKU Overlay with dark gradient & blur */}
      <Box
        position="absolute"
        top="0"
        left="0"
        right="0"
        px="2.5"
        py="1.5"
        bgGradient="to-b"
        gradientFrom="blackAlpha.700"
        gradientTo="transparent"
        color="white"
        zIndex="1"
        pointerEvents="none"
      >
        <Text fontSize="xs" fontWeight="600" color="white" lineClamp={1} textShadow="0 1px 2px rgba(0,0,0,0.6)">
          {brandName ?? '—'}
        </Text>
        <Text fontSize="10px" color="whiteAlpha.800" lineClamp={1} textShadow="0 1px 2px rgba(0,0,0,0.6)">
          {sku}
        </Text>
      </Box>

      {/* Product Image */}
      {imageUrl && !imageError ? (
        <Image
          src={imageUrl}
          alt={name}
          w="100%"
          h="100%"
          fit="contain"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          color="fg.muted"
          p="4"
        >
          <ImageOff size={24} style={{ opacity: 0.35 }} />
        </Box>
      )}
    </Box>
  )
}
