import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Dialog, HStack, Spinner, Text, VStack } from '@chakra-ui/react'

export function BarcodeCameraScanner({
  open,
  onClose,
  onDetected,
}: {
  open: boolean
  onClose: () => void
  onDetected: (barcode: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const video = videoRef.current
    if (!video) return

    let active = true
    let detected = false
    let controls: { stop: () => void } | undefined

    setError('')
    setStarting(true)
    const startScanner = async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        if (!active) return
        const hints = new Map([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [
              BarcodeFormat.EAN_13,
              BarcodeFormat.EAN_8,
              BarcodeFormat.UPC_A,
              BarcodeFormat.UPC_E,
              BarcodeFormat.CODE_128,
            ],
          ],
        ])
        const reader = new BrowserMultiFormatReader(hints)
        const scanControls = await reader.decodeFromVideoDevice(undefined, video, (result, scanError, scanControlsForFrame) => {
          controls = scanControlsForFrame
          if (!active || detected) return
          if (result) {
            detected = true
            const barcode = result.getText()
            scanControlsForFrame.stop()
            if (barcode) onDetectedRef.current(barcode)
            return
          }
          if (scanError && scanError.name !== 'NotFoundException') {
            setError('The camera could not read a barcode. Adjust the lighting and try again.')
          }
        })
        controls = scanControls
        if (active) setStarting(false)
        else scanControls.stop()
      } catch (cause: unknown) {
        if (!active) return
        setStarting(false)
        setError(
          cause instanceof Error && /permission|denied|notallowed/i.test(cause.name + cause.message)
            ? 'Camera access was denied. Allow camera permission in your browser and try again.'
            : 'No usable camera was found. Connect a camera or use a hardware scanner.',
        )
      }
    }
    void startScanner()

    return () => {
      active = false
      controls?.stop()
    }
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={(event) => !event.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner p="3">
        <Dialog.Content w="full" maxW="lg" borderRadius="lg" overflow="hidden">
          <Dialog.Header>
            <Dialog.Title>Scan barcode</Dialog.Title>
            <Dialog.Description>Position the barcode inside the camera view.</Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
            <VStack align="stretch" gap="3">
              <Box
                overflow="hidden"
                position="relative"
                borderRadius="md"
                bg="black"
                minH={{ base: '220px', sm: '300px' }}
                display="grid"
                placeItems="center"
              >
                <video
                  ref={videoRef}
                  aria-label="Live barcode scanner camera"
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%', maxHeight: '55vh', objectFit: 'cover' }}
                />
                {starting && (
                  <HStack color="white" position="absolute">
                    <Spinner size="sm" />
                    <Text>Starting camera…</Text>
                  </HStack>
                )}
              </Box>
              {error ? (
                <Alert.Root status="error">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              ) : (
                <Text color="fg.muted" fontSize="sm">
                  EAN-13, EAN-8, UPC-A, UPC-E and Code 128 are supported.
                </Text>
              )}
            </VStack>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
