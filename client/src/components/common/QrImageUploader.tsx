import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Grid,
  HStack,
  IconButton,
  Image,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  CheckCircle2,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import QRCode from 'qrcode'

import {
  createQrUploadSession,
  deleteMediaKey,
  getQrUploadStatus,
  type QrUploadPurpose,
} from '@/api/endpoints/qrUpload'

const MotionBox = motion.create(Box)

export interface UploadedImage {
  key: string
  previewUrl: string
}

export interface QrImageUploaderProps {
  purpose: QrUploadPurpose
  multiple?: boolean
  value?: UploadedImage[]
  onChange?: (images: UploadedImage[]) => void
  onRemove?: (index: number) => void
  onManualFileSelect?: (files: FileList | File[]) => void
  isUploadingManual?: boolean
  label?: string
  description?: string
  maxFiles?: number
  isNewEntity?: boolean
  initialKeys?: string[]
}

const PURPOSE_LABELS: Record<QrUploadPurpose, { title: string; subtitle: string }> = {
  PRODUCT_IMAGE: {
    title: 'Product Image',
    subtitle: 'Scan QR to capture or select product images from phone',
  },
  CATEGORY_IMAGE: {
    title: 'Category Image',
    subtitle: 'Scan QR to upload category image from phone',
  },
  BRAND_LOGO: {
    title: 'Brand Logo',
    subtitle: 'Scan QR to upload brand logo from phone',
  },
  CUSTOMER_PROFILE: {
    title: 'Customer Profile Picture',
    subtitle: 'Scan QR to take a photo or select profile picture',
  },
  COMPANY_LOGO: {
    title: 'Company Logo',
    subtitle: 'Scan QR to upload company logo from phone',
  },
}

export function QrImageUploader({
  purpose,
  multiple = false,
  value = [],
  onChange,
  onRemove,
  onManualFileSelect,
  isUploadingManual = false,
  label,
  description,
  maxFiles = multiple ? 10 : 1,
  isNewEntity = false,
  initialKeys,
}: QrImageUploaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900)
  const [status, setStatus] = useState<'IDLE' | 'GENERATING' | 'PENDING' | 'UPLOADED' | 'EXPIRED' | 'ERROR'>('IDLE')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const stopCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [])

  const handleClose = useCallback(() => {
    stopPolling()
    stopCountdown()
    setIsOpen(false)
    setStatus('IDLE')
    setSessionToken(null)
    setQrDataUrl(null)
  }, [stopPolling, stopCountdown])

  const startSession = useCallback(async () => {
    try {
      stopPolling()
      stopCountdown()
      setStatus('GENERATING')
      setErrorMessage(null)

      const session = await createQrUploadSession(purpose)
      const token = session.token

      const mobileUrl = `${window.location.origin}/mobile-upload?token=${encodeURIComponent(token)}`
      const url = await QRCode.toDataURL(mobileUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })

      setSessionToken(token)
      setQrDataUrl(url)
      setExpiresAt(session.expiresAt)

      const remaining = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000))
      setSecondsRemaining(remaining)
      setStatus('PENDING')
    } catch (err) {
      setStatus('ERROR')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate QR upload session.')
    }
  }, [purpose, stopPolling, stopCountdown])

  const handleOpenDialog = () => {
    setIsOpen(true)
    startSession()
  }

  // Countdown timer effect
  useEffect(() => {
    if (status === 'PENDING' && expiresAt) {
      stopCountdown()
      countdownIntervalRef.current = setInterval(() => {
        const rem = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
        setSecondsRemaining(rem)
        if (rem <= 0) {
          setStatus('EXPIRED')
          stopPolling()
          stopCountdown()
        }
      }, 1000)
    } else {
      stopCountdown()
    }
    return () => stopCountdown()
  }, [status, expiresAt, stopCountdown, stopPolling])

  // Status Polling effect
  useEffect(() => {
    if (status === 'PENDING' && sessionToken) {
      stopPolling()
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await getQrUploadStatus(sessionToken)
          if (res.status === 'UPLOADED') {
            stopPolling()
            stopCountdown()
            setStatus('UPLOADED')

            const newImages: UploadedImage[] = res.keys.map((key, i) => ({
              key,
              previewUrl: res.previewUrls[i] || '',
            }))

            if (onChange) {
              if (multiple) {
                const combined = [...value, ...newImages]
                onChange(combined.slice(0, maxFiles))
              } else {
                onChange(newImages.slice(0, 1))
              }
            }
          } else if (res.status === 'EXPIRED') {
            stopPolling()
            stopCountdown()
            setStatus('EXPIRED')
          }
        } catch {
          // ignore transient poll errors
        }
      }, 3000)
    } else {
      stopPolling()
    }
    return () => stopPolling()
  }, [status, sessionToken, onChange, value, multiple, maxFiles, stopPolling, stopCountdown])

  useEffect(() => {
    return () => {
      stopPolling()
      stopCountdown()
    }
  }, [stopPolling, stopCountdown])

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const s = secs % 60
    return `${mins}:${s < 10 ? '0' : ''}${s}`
  }

  const handleRemoveImage = async (index: number) => {
    const targetImage = value[index]
    if (onRemove) {
      onRemove(index)
    } else if (onChange) {
      const updated = value.filter((_, i) => i !== index)
      onChange(updated)
    }

    if (targetImage?.key) {
      const isSavedInDb = !isNewEntity && Boolean(initialKeys && initialKeys.includes(targetImage.key))
      if (!isSavedInDb) {
        try {
          await deleteMediaKey(targetImage.key)
        } catch (err) {
          console.error('Failed to delete pending media object:', err)
        }
      }
    }
  }

  const purposeInfo = PURPOSE_LABELS[purpose] || {
    title: label || 'Image Upload',
    subtitle: 'Upload images from device or via mobile QR scan',
  }

  return (
    <VStack align="stretch" gap="3" w="full">
      {label && (
        <HStack justify="space-between" align="center">
          <Text fontSize="sm" fontWeight="600" color="gray.700">
            {label}
          </Text>
          {multiple && maxFiles > 1 && (
            <Badge size="sm" variant="subtle" colorPalette="blue">
              {value.length} / {maxFiles} images
            </Badge>
          )}
        </HStack>
      )}

      {/* Upload Buttons & Drop Area */}
      <Card.Root variant="outline" p="4" borderRadius="lg" bg="gray.50/50">
        <VStack align="stretch" gap="3">
          {/* Previews Grid */}
          {value.length > 0 && (
            <Grid
              templateColumns={
                multiple ? { base: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' } : '1fr'
              }
              gap="3"
            >
              <AnimatePresence>
                {value.map((img, idx) => (
                  <MotionBox
                    key={img.key || idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    position="relative"
                    borderRadius="md"
                    overflow="hidden"
                    borderWidth="1px"
                    borderColor="gray.200"
                    bg="white"
                    maxH={multiple ? '100px' : '160px'}
                  >
                    <Image
                      src={img.previewUrl}
                      alt={`Image ${idx + 1}`}
                      objectFit="cover"
                      w="full"
                      h={multiple ? '100px' : '160px'}
                    />
                    <IconButton
                      aria-label="Remove image"
                      size="xs"
                      colorPalette="red"
                      variant="solid"
                      position="absolute"
                      top="1.5"
                      right="1.5"
                      onClick={() => handleRemoveImage(idx)}
                      borderRadius="full"
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </MotionBox>
                ))}
              </AnimatePresence>
            </Grid>
          )}

          {/* Action Buttons */}
          {(!multiple && value.length === 0) || (multiple && value.length < maxFiles) ? (
            <HStack gap="3" flexWrap="wrap">
              {onManualFileSelect && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple={multiple}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        onManualFileSelect(e.target.files)
                        e.target.value = ''
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    loading={isUploadingManual}
                    flex="1"
                  >
                    <UploadCloud size={16} />
                    <span>Choose File</span>
                  </Button>
                </>
              )}

              <Button
                size="sm"
                colorPalette="blue"
                variant="subtle"
                onClick={handleOpenDialog}
                flex="1"
              >
                <QrCode size={16} />
                <span>Upload via QR Code</span>
              </Button>
            </HStack>
          ) : null}

          {description && (
            <Text fontSize="xs" color="gray.500">
              {description}
            </Text>
          )}
        </VStack>
      </Card.Root>

      {/* QR Upload Modal */}
      <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="md">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="xl" overflow="hidden">
            <Dialog.Header bg="gray.50" borderBottomWidth="1px" p="4">
              <HStack justify="space-between" align="center" w="full">
                <HStack gap="2">
                  <Box p="2" bg="blue.50" color="blue.600" borderRadius="md">
                    <QrCode size={20} />
                  </Box>
                  <Box>
                    <Dialog.Title fontSize="md" fontWeight="700">
                      {purposeInfo.title} via QR Code
                    </Dialog.Title>
                    <Dialog.Description fontSize="xs" color="gray.500">
                      {purposeInfo.subtitle}
                    </Dialog.Description>
                  </Box>
                </HStack>
                <Dialog.CloseTrigger asChild>
                  <IconButton size="xs" variant="ghost" aria-label="Close modal">
                    <X size={16} />
                  </IconButton>
                </Dialog.CloseTrigger>
              </HStack>
            </Dialog.Header>

            <Dialog.Body p="6">
              <VStack align="center" justify="center" gap="5" py="2">
                {status === 'GENERATING' && (
                  <VStack gap="3" py="8">
                    <Spinner size="xl" color="blue.500" />
                    <Text fontSize="sm" color="gray.600">
                      Generating secure QR session...
                    </Text>
                  </VStack>
                )}

                {status === 'PENDING' && qrDataUrl && (
                  <MotionBox
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    w="full"
                  >
                    <VStack gap="4" align="center">
                      {/* QR Display Card */}
                      <Box
                        p="4"
                        bg="white"
                        borderRadius="xl"
                        borderWidth="1px"
                        borderColor="gray.200"
                        boxShadow="md"
                        position="relative"
                      >
                        <Image src={qrDataUrl} alt="QR Code" w="220px" h="220px" borderRadius="md" />
                      </Box>

                      {/* Instructions & Expiry */}
                      <VStack gap="1" textStyle="center">
                        <HStack gap="1.5" color="blue.600" fontSize="xs" fontWeight="600">
                          <Smartphone size={15} />
                          <Text>Scan with your phone camera</Text>
                        </HStack>
                        <Text fontSize="xs" color="gray.500">
                          No app required. Directly uploads from phone to POS.
                        </Text>
                      </VStack>

                      {/* Expiry Badge & Refresh */}
                      <HStack gap="3" align="center" bg="gray.100" px="3" py="1.5" borderRadius="full">
                        <HStack gap="1">
                          <Spinner size="xs" color="blue.500" />
                          <Text fontSize="xs" color="gray.600">
                            Waiting for scan...
                          </Text>
                        </HStack>
                        <Badge
                          size="sm"
                          colorPalette={secondsRemaining < 60 ? 'red' : 'blue'}
                          variant="solid"
                          borderRadius="full"
                        >
                          Expires in {formatCountdown(secondsRemaining)}
                        </Badge>
                      </HStack>
                    </VStack>
                  </MotionBox>
                )}

                {status === 'UPLOADED' && (
                  <MotionBox
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    w="full"
                    py="4"
                  >
                    <VStack gap="3" align="center" textStyle="center">
                      <Box p="3" bg="green.100" color="green.600" borderRadius="full">
                        <CheckCircle2 size={42} />
                      </Box>
                      <Text fontSize="lg" fontWeight="700" color="gray.800">
                        Upload Successful!
                      </Text>
                      <Text fontSize="xs" color="gray.500" maxW="280px">
                        Image(s) transferred from mobile device and attached to your form.
                      </Text>
                    </VStack>
                  </MotionBox>
                )}

                {status === 'EXPIRED' && (
                  <VStack gap="3" py="4" textStyle="center">
                    <Badge colorPalette="orange" size="lg" p="2" borderRadius="md">
                      Session Expired
                    </Badge>
                    <Text fontSize="xs" color="gray.500">
                      The QR session expired after 15 minutes. Please generate a new QR code.
                    </Text>
                  </VStack>
                )}

                {status === 'ERROR' && (
                  <VStack gap="3" py="4" textStyle="center">
                    <Text fontSize="sm" color="red.600" fontWeight="600">
                      {errorMessage || 'Could not create QR session.'}
                    </Text>
                  </VStack>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer bg="gray.50" borderTopWidth="1px" p="4">
              <HStack justify="space-between" w="full">
                {status === 'PENDING' || status === 'EXPIRED' || status === 'ERROR' ? (
                  <Button size="sm" variant="ghost" onClick={startSession}>
                    <RefreshCw size={14} />
                    <span>Regenerate QR</span>
                  </Button>
                ) : (
                  <Box />
                )}

                <Button size="sm" colorPalette={status === 'UPLOADED' ? 'green' : 'gray'} onClick={handleClose}>
                  {status === 'UPLOADED' ? 'Done' : 'Close'}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  )
}
