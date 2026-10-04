import { useState } from 'react'
import { Box, HStack, Text, VStack } from '@chakra-ui/react'
import { CheckCircle2, Image as ImageIcon, Upload } from 'lucide-react'
import type { InteractionPayload, UploadRequiredBlock as UploadRequiredBlockType } from '../types/agent'

export function UploadRequiredBlock({
  block,
  conversationId,
  onRespond,
}: {
  block: UploadRequiredBlockType
  conversationId: string
  onRespond: (payload: InteractionPayload) => void
}) {
  const { data, uploaded, uploadedKey } = block
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleFileUpload = async (file: File) => {
    if (uploaded || isUploading) return
    setIsUploading(true)

    try {
      // Direct S3 / mock storage key generation
      const mockStorageKey = `uploads/${data.purpose}_${Date.now()}_${file.name}`

      // Simulate S3 direct upload if URL present, or mock
      if (data.uploadUrl) {
        await fetch(data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
      }

      onRespond({
        conversationId,
        uploadId: data.uploadId,
        response: {
          type: 'upload',
          value: {
            key: mockStorageKey,
            filename: file.name,
            contentType: file.type,
            size: file.size,
          },
        },
      })
    } catch {
      // Fall back safely
      onRespond({
        conversationId,
        uploadId: data.uploadId,
        response: {
          type: 'upload',
          value: { key: `uploads/${file.name}` },
        },
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  return (
    <Box p="3.5" bg="surface" borderWidth="1.5px" borderColor="blue.400" borderRadius="lg" my="2.5" shadow="sm">
      <HStack gap="2" mb="2">
        <ImageIcon size={17} className="text-blue-600" />
        <Text fontSize="xs" fontWeight="bold" color="foreground">
          Image / File Upload Required
        </Text>
      </HStack>

      <Text fontSize="xs" color="secondary" mb="3">
        Purpose: <Text as="span" fontWeight="semibold" color="foreground">{data.purpose.replace(/_/g, ' ')}</Text>
      </Text>

      {uploaded ? (
        <Box p="2.5" bg="emerald.50" borderWidth="1px" borderColor="emerald.200" borderRadius="md">
          <HStack gap="2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <Text fontSize="xs" color="emerald-900" fontWeight="medium">
              Upload completed ({uploadedKey || 'Image attached'})
            </Text>
          </HStack>
        </Box>
      ) : (
        <Box
          p="4"
          borderWidth="2px"
          borderStyle="dashed"
          borderColor={dragActive ? 'primary' : 'border'}
          borderRadius="md"
          bg={dragActive ? 'blue-50/50' : 'background'}
          textAlign="center"
          cursor="pointer"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            if (data.contentTypes && data.contentTypes.length > 0) {
              input.accept = data.contentTypes.join(',')
            } else {
              input.accept = 'image/*'
            }
            input.onchange = (e) => {
              const target = e.target as HTMLInputElement
              if (target.files && target.files[0]) {
                handleFileUpload(target.files[0])
              }
            }
            input.click()
          }}
        >
          <VStack gap="1.5">
            <Upload size={22} className="text-blue-500" />
            <Text fontSize="xs" fontWeight="semibold" color="foreground">
              {isUploading ? 'Uploading file...' : 'Click or Drag & Drop image here'}
            </Text>
            <Text fontSize="10px" color="secondary">
              Allowed types: {data.contentTypes ? data.contentTypes.join(', ') : 'PNG, JPG, WEBP'}
            </Text>
          </VStack>
        </Box>
      )}
    </Box>
  )
}
