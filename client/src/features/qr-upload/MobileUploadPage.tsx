import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Grid,
  HStack,
  IconButton,
  Image,
  Progress,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  Camera,
  CheckCircle2,
  Smartphone,
  Trash2,
  Upload,
  AlertTriangle,
} from 'lucide-react'

import {
  completeQrUploadSession,
  getMobileQrSessionInfo,
  requestQrUploadPresignedUrls,
  type QrUploadPurpose,
} from '@/api/endpoints/qrUpload'

interface LocalFile {
  id: string
  file: File
  previewUrl: string
}

const PURPOSE_TITLE: Record<QrUploadPurpose, string> = {
  PRODUCT_IMAGE: 'Product Image Upload',
  CATEGORY_IMAGE: 'Category Image Upload',
  BRAND_LOGO: 'Brand Logo Upload',
  CUSTOMER_PROFILE: 'Customer Profile Picture',
  COMPANY_LOGO: 'Company Logo Upload',
}

export function MobileUploadPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loadingSession, setLoadingSession] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [purpose, setPurpose] = useState<QrUploadPurpose | null>(null)
  const [isMultiple, setIsMultiple] = useState(false)

  const [selectedFiles, setSelectedFiles] = useState<LocalFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setSessionError('Missing upload session token.')
      setLoadingSession(false)
      return
    }

    getMobileQrSessionInfo(token)
      .then((info) => {
        if (info.status === 'UPLOADED') {
          setUploadSuccess(true)
        }
        setPurpose(info.purpose)
        setIsMultiple(info.isMultiple)
        setLoadingSession(false)
      })
      .catch((err) => {
        setSessionError(err instanceof Error ? err.message : 'Invalid or expired upload session.')
        setLoadingSession(false)
      })
  }, [token])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const newFiles: LocalFile[] = Array.from(e.target.files).map((f) => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      previewUrl: URL.createObjectURL(f),
    }))

    if (isMultiple) {
      setSelectedFiles((prev) => [...prev, ...newFiles].slice(0, 10))
    } else {
      setSelectedFiles(newFiles.slice(0, 1))
    }
  }

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleUpload = async () => {
    if (!token || selectedFiles.length === 0) return

    try {
      setUploading(true)
      setUploadProgress(10)
      setUploadError(null)

      const filePayloads = selectedFiles.map((sf) => ({
        contentType: sf.file.type || 'image/jpeg',
        size: sf.file.size,
      }))

      // Step 1: Request presigned upload URLs from backend
      const presignRes = await requestQrUploadPresignedUrls(token, filePayloads)
      setUploadProgress(30)

      // Step 2: Upload each file directly to S3 via presigned PUT URLs
      const uploadedKeys: string[] = []
      const totalCount = presignRes.files.length

      for (let i = 0; i < totalCount; i++) {
        const target = presignRes.files[i]
        const fileObj = selectedFiles[i].file

        const s3Response = await fetch(target.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': target.contentType,
          },
          body: fileObj,
        })

        if (!s3Response.ok) {
          throw new Error(`S3 direct upload failed for file ${i + 1} (${s3Response.status}).`)
        }

        uploadedKeys.push(target.key)
        setUploadProgress(30 + Math.floor(((i + 1) / totalCount) * 50))
      }

      // Step 3: Complete session on backend
      setUploadProgress(85)
      await completeQrUploadSession(token, uploadedKeys)
      setUploadProgress(100)
      setUploading(false)
      setUploadSuccess(true)
    } catch (err) {
      setUploading(false)
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    }
  }

  if (loadingSession) {
    return (
      <Container maxW="md" py="16" centerContent>
        <VStack gap="4">
          <Spinner size="xl" color="blue.500" />
          <Text fontSize="sm" color="gray.600">
            Connecting to POS upload session...
          </Text>
        </VStack>
      </Container>
    )
  }

  if (sessionError) {
    return (
      <Container maxW="md" py="12">
        <Card.Root variant="outline" p="6" textStyle="center">
          <VStack gap="4">
            <Box p="3" bg="red.100" color="red.600" borderRadius="full">
              <AlertTriangle size={36} />
            </Box>
            <Text fontSize="lg" fontWeight="700" color="gray.800">
              Session Unavailable
            </Text>
            <Text fontSize="xs" color="gray.600">
              {sessionError}
            </Text>
            <Text fontSize="xs" color="gray.500">
              Please return to your desktop POS application and generate a fresh QR code.
            </Text>
          </VStack>
        </Card.Root>
      </Container>
    )
  }

  if (uploadSuccess) {
    return (
      <Container maxW="md" py="12">
        <Card.Root variant="outline" p="6" textStyle="center" boxShadow="lg">
          <VStack gap="4">
            <Box p="3" bg="green.100" color="green.600" borderRadius="full">
              <CheckCircle2 size={48} />
            </Box>
            <Text fontSize="xl" fontWeight="700" color="gray.800">
              Upload Complete!
            </Text>
            <Text fontSize="sm" color="gray.600">
              Your image(s) have been successfully transferred to the POS desktop session.
            </Text>
            <Badge colorPalette="green" size="lg">
              You may now close this browser window.
            </Badge>
          </VStack>
        </Card.Root>
      </Container>
    )
  }

  return (
    <Container maxW="md" py="6" px="4">
      <VStack align="stretch" gap="5">
        {/* Header */}
        <HStack justify="space-between" align="center" borderBottomWidth="1px" pb="3">
          <HStack gap="2">
            <Box p="2" bg="blue.50" color="blue.600" borderRadius="lg">
              <Smartphone size={22} />
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="700" color="gray.800">
                POS Mobile Direct Upload
              </Text>
              <Text fontSize="xs" color="gray.500">
                {purpose ? PURPOSE_TITLE[purpose] : 'Image Upload'}
              </Text>
            </Box>
          </HStack>
          <Badge colorPalette="blue" size="sm">
            {isMultiple ? 'Multiple Images' : 'Single Image'}
          </Badge>
        </HStack>

        {/* Upload Form Card */}
        <Card.Root variant="outline" p="4" boxShadow="sm">
          <VStack align="stretch" gap="4">
            {/* Pickers */}
            <VStack gap="2">
              <label style={{ width: '100%' }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple={isMultiple}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <Button
                  as="span"
                  w="full"
                  size="lg"
                  colorPalette="blue"
                  variant="subtle"
                  py="6"
                  borderRadius="xl"
                  cursor="pointer"
                >
                  <Camera size={22} />
                  <span>{selectedFiles.length > 0 ? 'Choose More Images' : 'Take Photo or Choose File'}</span>
                </Button>
              </label>
            </VStack>

            {/* Selected Files Preview Grid */}
            {selectedFiles.length > 0 && (
              <VStack align="stretch" gap="2">
                <Text fontSize="xs" fontWeight="600" color="gray.700">
                  Selected ({selectedFiles.length})
                </Text>
                <Grid templateColumns="repeat(2, 1fr)" gap="3">
                  {selectedFiles.map((sf) => (
                    <Box
                      key={sf.id}
                      position="relative"
                      borderRadius="lg"
                      overflow="hidden"
                      borderWidth="1px"
                      borderColor="gray.200"
                    >
                      <Image src={sf.previewUrl} alt="Preview" w="full" h="120px" objectFit="cover" />
                      <IconButton
                        aria-label="Remove"
                        size="xs"
                        colorPalette="red"
                        position="absolute"
                        top="1"
                        right="1"
                        onClick={() => handleRemoveFile(sf.id)}
                        borderRadius="full"
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </Box>
                  ))}
                </Grid>
              </VStack>
            )}

            {/* Upload Action */}
            {selectedFiles.length > 0 && (
              <VStack align="stretch" gap="3" pt="2">
                {uploading && (
                  <VStack align="stretch" gap="1">
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.600">
                        Uploading to S3...
                      </Text>
                      <Text fontSize="xs" fontWeight="700">
                        {uploadProgress}%
                      </Text>
                    </HStack>
                    <Progress.Root value={uploadProgress} size="sm" colorPalette="blue">
                      <Progress.Track>
                        <Progress.Range />
                      </Progress.Track>
                    </Progress.Root>
                  </VStack>
                )}

                {uploadError && (
                  <Text fontSize="xs" color="red.600" textStyle="center">
                    {uploadError}
                  </Text>
                )}

                <Button
                  size="lg"
                  colorPalette="green"
                  onClick={handleUpload}
                  loading={uploading}
                  disabled={uploading}
                  borderRadius="xl"
                >
                  <Upload size={20} />
                  <span>Send to POS Desktop</span>
                </Button>
              </VStack>
            )}
          </VStack>
        </Card.Root>
      </VStack>
    </Container>
  )
}
