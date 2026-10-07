import { useState } from 'react'
import { Box, Image } from '@chakra-ui/react'
import { ImageOff } from 'lucide-react'

export function ProductImage({
  imageUrls,
  name,
}: {
  imageUrls?: string[] | null
  name: string
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
          <ImageOff size={28} style={{ opacity: 0.4 }} />
        </Box>
      )}
    </Box>
  )
}
