import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Alert, Button, Dialog, Field, HStack, Input, RadioGroup, Stack, Text } from '@chakra-ui/react'
import { Printer } from 'lucide-react'
import bwipjs from 'bwip-js/browser'
import type { CatalogProduct } from '@/api/endpoints/catalog'
import { formatCurrency } from '@/lib/formatters'

type PrintFormat = 'a4' | 'thermal'
type ThermalSize = '50x25' | '50x30' | '100x50'
type LabelContentOption = 'name' | 'rrp' | 'sellingPrice'
type A4LayoutPreset = 'custom' | '45-labels'
type BarcodePrintSettings = {
  format: PrintFormat
  a4LayoutPreset: A4LayoutPreset
  labelWidth: number
  labelHeight: number
  margin: number
  spacing: number
  columns: number
  thermalSize: ThermalSize
  labelContent: Record<LabelContentOption, boolean>
}

const MAX_LABELS = 500
const BARCODE_PRINT_SETTINGS_KEY = 'pos-barcode-print-settings'
const thermalDimensions: Record<ThermalSize, { width: number; height: number }> = {
  '50x25': { width: 50, height: 25 },
  '50x30': { width: 50, height: 30 },
  '100x50': { width: 100, height: 50 },
}

function defaultBarcodePrintSettings(): BarcodePrintSettings {
  return {
    format: 'a4',
    a4LayoutPreset: 'custom',
    labelWidth: 50,
    labelHeight: 25,
    margin: 7,
    spacing: 2,
    columns: 3,
    thermalSize: '50x25',
    labelContent: { name: true, rrp: false, sellingPrice: true },
  }
}

function isBarcodePrintSettings(value: unknown): value is BarcodePrintSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const settings = value as Record<string, unknown>
  const content = settings.labelContent
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false
  const labelContent = content as Record<string, unknown>
  return (
    (settings.format === 'a4' || settings.format === 'thermal') &&
    (settings.a4LayoutPreset === 'custom' || settings.a4LayoutPreset === '45-labels') &&
    typeof settings.labelWidth === 'number' &&
    Number.isFinite(settings.labelWidth) &&
    settings.labelWidth >= 10 &&
    settings.labelWidth <= 200 &&
    typeof settings.labelHeight === 'number' &&
    Number.isFinite(settings.labelHeight) &&
    settings.labelHeight >= 10 &&
    settings.labelHeight <= 280 &&
    typeof settings.margin === 'number' &&
    Number.isFinite(settings.margin) &&
    settings.margin >= 0 &&
    settings.margin <= 50 &&
    typeof settings.spacing === 'number' &&
    Number.isFinite(settings.spacing) &&
    settings.spacing >= 0 &&
    settings.spacing <= 30 &&
    typeof settings.columns === 'number' &&
    Number.isInteger(settings.columns) &&
    settings.columns >= 1 &&
    settings.columns <= 20 &&
    (settings.thermalSize === '50x25' || settings.thermalSize === '50x30' || settings.thermalSize === '100x50') &&
    typeof labelContent.name === 'boolean' &&
    typeof labelContent.rrp === 'boolean' &&
    typeof labelContent.sellingPrice === 'boolean'
  )
}

function readBarcodePrintSettings(): BarcodePrintSettings {
  try {
    const saved = window.localStorage.getItem(BARCODE_PRINT_SETTINGS_KEY)
    if (!saved) return defaultBarcodePrintSettings()
    const parsed: unknown = JSON.parse(saved)
    if (isBarcodePrintSettings(parsed)) return parsed
    console.warn('Saved barcode print settings are invalid; using defaults.')
  } catch (cause) {
    console.error('Unable to read saved barcode print settings.', cause)
  }
  return defaultBarcodePrintSettings()
}

function checksumMatches(value: string, firstWeight: number, secondWeight: number): boolean {
  const digits = value.slice(0, -1).split('').map(Number)
  if (!digits.every(Number.isInteger)) return false
  const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? firstWeight : secondWeight), 0)
  return (10 - (sum % 10)) % 10 === Number(value.at(-1))
}

function barcodeType(value: string): string {
  if (/^\d{13}$/.test(value) && checksumMatches(value, 1, 3)) return 'ean13'
  if (/^\d{8}$/.test(value) && checksumMatches(value, 3, 1)) return 'ean8'
  if (/^\d{12}$/.test(value) && checksumMatches(value, 3, 1)) return 'upca'
  return 'code128'
}

function safeBarcodeSvg(value: string): string {
  return bwipjs.toSVG({
    bcid: barcodeType(value),
    text: value,
    scale: 3,
    height: 12,
    includetext: false,
    padding: 8,
    backgroundcolor: 'FFFFFF',
    barcolor: '000000',
  })
}

function Label({
  product,
  svg,
  showName,
  showRrp,
  showSellingPrice,
}: {
  product: CatalogProduct
  svg: string
  showName: boolean
  showRrp: boolean
  showSellingPrice: boolean
}) {
  const rrp = product.rrp
  return (
    <div className="barcode-label">
      {showName && <div className="barcode-product-name">{product.name}</div>}
            <img className="barcode-graphic" src={`data:image/svg+xml,${encodeURIComponent(svg)}`} alt="" />
      <div className="barcode-value">{product.barcode}</div>
      {showRrp && rrp !== undefined && showSellingPrice ? (
        <div className="barcode-prices">
          <span className="barcode-rrp">{formatCurrency(rrp)}</span>
          <strong className="barcode-selling-price">{formatCurrency(product.sellingPrice)}</strong>
        </div>
      ) : showRrp && rrp !== undefined && !showSellingPrice ? (
        <strong className="barcode-single-price">{formatCurrency(rrp)}</strong>
      ) : showSellingPrice ? (
        <strong className="barcode-single-price">{formatCurrency(product.sellingPrice)}</strong>
      ) : null}

    </div>
  )
}

export function BarcodePrintDialog({
  product,
  open,
  onClose,
}: {
  product: CatalogProduct | null
  open: boolean
  onClose: () => void
}) {
  const [settings, setSettings] = useState<BarcodePrintSettings>(readBarcodePrintSettings)
  const [quantity, setQuantity] = useState(1)
  const { format, a4LayoutPreset, labelWidth, labelHeight, margin, spacing, columns, thermalSize, labelContent } =
    settings

  const updateSetting = <Key extends keyof BarcodePrintSettings>(key: Key, value: BarcodePrintSettings[Key]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const applyA4LayoutPreset = (preset: A4LayoutPreset) => {
    setSettings((current) =>
      preset === '45-labels'
        ? {
            ...current,
            a4LayoutPreset: preset,
            labelWidth: 37.6,
            labelHeight: 29.6,
            margin: 7,
            spacing: 2,
            columns: 5,
          }
        : { ...current, a4LayoutPreset: preset },
    )
  }

  const updateA4Dimension = <Key extends 'labelWidth' | 'labelHeight' | 'margin' | 'spacing' | 'columns'>(
    key: Key,
    value: BarcodePrintSettings[Key],
  ) => {
    setSettings((current) => ({ ...current, [key]: value, a4LayoutPreset: 'custom' }))
  }

  useEffect(() => {
    if (!open) return
    setQuantity(1)
  }, [open, product?.id])

  useEffect(() => {
    try {
      window.localStorage.setItem(BARCODE_PRINT_SETTINGS_KEY, JSON.stringify(settings))
    } catch (cause) {
      console.error('Unable to save barcode print settings.', cause)
    }
  }, [settings])

  const updateLabelContent = (option: LabelContentOption, checked: boolean) => {
    updateSetting('labelContent', { ...labelContent, [option]: checked })
  }

  useEffect(() => {
    if (!open) return
    window.addEventListener('afterprint', onClose)
    return () => window.removeEventListener('afterprint', onClose)
  }, [onClose, open])

  const barcodeResult = useMemo(() => {
    if (!product?.barcode) return { svg: '', error: '' }
    try {
      return { svg: safeBarcodeSvg(product.barcode), error: '' }
    } catch (cause) {
      return {
        svg: '',
        error: cause instanceof Error ? cause.message : 'This barcode could not be rendered.',
      }
    }
  }, [product?.barcode])
  const { svg, error: barcodeError } = barcodeResult

  const thermal = thermalDimensions[thermalSize]
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_LABELS
  const a4Rows = Math.floor((297 - margin * 2 + spacing) / (labelHeight + spacing))
  const a4Fits =
    Number.isFinite(labelWidth) &&
    Number.isFinite(labelHeight) &&
    Number.isFinite(margin) &&
    Number.isFinite(spacing) &&
    Number.isInteger(columns) &&
    labelWidth > 0 &&
    labelHeight > 0 &&
    margin >= 0 &&
    spacing >= 0 &&
    columns >= 1 &&
    margin * 2 + columns * labelWidth + (columns - 1) * spacing <= 210 &&
    a4Rows > 0
  const pageCapacity = a4Fits ? columns * a4Rows : 0
  const pages = useMemo(() => {
    if (!validQuantity || !a4Fits || !svg) return []
    if (format === 'thermal') return Array.from({ length: quantity }, () => [0])
    return Array.from({ length: Math.ceil(quantity / pageCapacity) }, (_, page) =>
      Array.from({ length: Math.min(pageCapacity, quantity - page * pageCapacity) }, () => 0),
    )
  }, [a4Fits, format, pageCapacity, quantity, svg, validQuantity])
  const printCss = `
    .barcode-label { box-sizing: border-box; width: 100%; height: 100%; overflow: hidden; border: 1px solid #d4d4d8; padding: 1mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5mm; color: #000; background: #fff; font-family: Arial, sans-serif; }
    .barcode-product-name { flex: 0 0 auto; width: 100%; min-height: 1em; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font-size: 8pt; line-height: 1.1; }
    .barcode-prices { flex: 0 0 auto; display: flex; align-items: baseline; justify-content: center; gap: 2mm; font-size: 8pt; }
    .barcode-rrp { text-decoration: line-through; }
    .barcode-selling-price, .barcode-single-price { flex: 0 0 auto; font-size: 9pt; }
    .barcode-graphic { display: block; flex: 1 1 auto; min-height: 0; width: 94%; max-width: 100%; height: auto; max-height: 45%; object-fit: contain; }
    .barcode-value { flex: 0 0 auto; font-family: monospace; font-size: 8pt; letter-spacing: 0.2mm; line-height: 1; }
    @page { size: ${format === 'a4' ? 'A4' : `${thermal.width}mm ${thermal.height}mm`}; margin: 0; }
    #barcode-print-root { display: none; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; }
      body * { visibility: hidden !important; }
      #barcode-print-root, #barcode-print-root * { visibility: visible !important; }
      #barcode-print-root { display: block !important; position: absolute !important; inset: 0 auto auto 0 !important; color: #000 !important; background: #fff !important; }
      #barcode-print-root .barcode-sheet { box-sizing: border-box; width: 210mm; height: 297mm; padding: ${margin}mm; display: grid; grid-template-columns: repeat(${columns}, ${labelWidth}mm); grid-auto-rows: ${labelHeight}mm; column-gap: ${spacing}mm; row-gap: ${spacing}mm; page-break-after: always; break-after: page; overflow: hidden; }
      #barcode-print-root .barcode-thermal-page { box-sizing: border-box; width: ${thermal.width}mm; height: ${thermal.height}mm; padding: 1mm; page-break-after: always; break-after: page; overflow: hidden; }
      #barcode-print-root .barcode-thermal-page:last-child, #barcode-print-root .barcode-sheet:last-child { page-break-after: auto; break-after: auto; }
      #barcode-print-root .barcode-label { border: 0; padding: 1mm; gap: 0.5mm; }
    }
  `

  const label = () =>
    product && svg ? (
      <Label
        product={product}
        svg={svg}
        showName={labelContent.name}
        showRrp={labelContent.rrp}
        showSellingPrice={labelContent.sellingPrice}
      />
    ) : null

  const handlePrint = () => {
    if (!validQuantity || !svg || (format === 'a4' && !a4Fits)) return
    window.print()
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(event) => !event.open && onClose()}>
        <Dialog.Backdrop />
        <Dialog.Positioner p="3">
          <Dialog.Content maxW="3xl" maxH="92vh" overflowY="auto">
            <Dialog.Header>
              <Dialog.Title>Print barcode labels</Dialog.Title>
              <Dialog.Description>
                {product?.name ?? 'Selected product'} · {product?.barcode ?? 'No saved barcode'}
              </Dialog.Description>
            </Dialog.Header>
            <Dialog.Body>
              {!product?.barcode ? (
                <Alert.Root status="warning">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>No saved barcode</Alert.Title>
                    <Alert.Description>
                      Edit this product and generate or enter a barcode, then save it before printing labels.
                    </Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              ) : barcodeError || !svg ? (
                <Alert.Root status="error">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Barcode could not be rendered</Alert.Title>
                    <Alert.Description>
                      {barcodeError || 'No barcode image was generated, so printing is unavailable.'}
                    </Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              ) : (
                <Stack gap="5">
                  <Field.Root>
                    <Field.Label>Number of labels</Field.Label>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_LABELS}
                      step={1}
                      value={quantity}
                      onChange={(event) => setQuantity(Number(event.target.value))}
                    />
                    <Field.HelperText>Enter a whole number from 1 to {MAX_LABELS}.</Field.HelperText>
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Print format</Field.Label>
                    <RadioGroup.Root
                      value={format}
                      onValueChange={(event) => updateSetting('format', event.value as PrintFormat)}
                    >
                      <HStack gap="5" wrap="wrap">
                        <RadioGroup.Item value="a4">
                          <RadioGroup.ItemHiddenInput />
                          <RadioGroup.ItemIndicator />
                          <RadioGroup.ItemText>A4 sticker sheet</RadioGroup.ItemText>
                        </RadioGroup.Item>
                        <RadioGroup.Item value="thermal">
                          <RadioGroup.ItemHiddenInput />
                          <RadioGroup.ItemIndicator />
                          <RadioGroup.ItemText>Thermal label printer</RadioGroup.ItemText>
                        </RadioGroup.Item>
                      </HStack>
                    </RadioGroup.Root>
                  </Field.Root>
                  {format === 'a4' ? (
                    <Stack gap="3">
                      <Field.Root>
                        <Field.Label>A4 layout preset</Field.Label>
                        <select
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={a4LayoutPreset}
                          onChange={(event) => applyA4LayoutPreset(event.target.value as A4LayoutPreset)}
                        >
                          <option value="custom">Custom</option>
                          <option value="45-labels">45 labels per sheet (5 columns × 9 rows)</option>
                        </select>
                      </Field.Root>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <Field.Root>
                          <Field.Label>Width (mm)</Field.Label>
                          <Input
                            type="number"
                            min={10}
                            max={200}
                            value={labelWidth}
                            onChange={(e) => updateA4Dimension('labelWidth', Number(e.target.value))}
                          />
                        </Field.Root>
                        <Field.Root>
                          <Field.Label>Height (mm)</Field.Label>
                          <Input
                            type="number"
                            min={10}
                            max={280}
                            value={labelHeight}
                            onChange={(e) => updateA4Dimension('labelHeight', Number(e.target.value))}
                          />
                        </Field.Root>
                        <Field.Root>
                          <Field.Label>Margin (mm)</Field.Label>
                          <Input
                            type="number"
                            min={0}
                            max={50}
                            value={margin}
                            onChange={(e) => updateA4Dimension('margin', Number(e.target.value))}
                          />
                        </Field.Root>
                        <Field.Root>
                          <Field.Label>Spacing (mm)</Field.Label>
                          <Input
                            type="number"
                            min={0}
                            max={30}
                            value={spacing}
                            onChange={(e) => updateA4Dimension('spacing', Number(e.target.value))}
                          />
                        </Field.Root>
                        <Field.Root>
                          <Field.Label>Columns</Field.Label>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            step={1}
                            value={columns}
                            onChange={(e) => updateA4Dimension('columns', Number(e.target.value))}
                          />
                        </Field.Root>
                      </div>
                    </Stack>
                  ) : (
                    <Stack gap="2">
                      <Field.Root>
                        <Field.Label>Thermal label size</Field.Label>
                        <select
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={thermalSize}
                          onChange={(event) => updateSetting('thermalSize', event.target.value as ThermalSize)}
                        >
                          <option value="50x25">50 × 25 mm</option>
                          <option value="50x30">50 × 30 mm</option>
                          <option value="100x50">100 × 50 mm</option>
                        </select>
                      </Field.Root>
                      <Text fontSize="sm" color="fg.muted">
                        Set the printer driver and physical paper/roll size to match this selection. The browser and
                        operating system handle printer selection.
                      </Text>
                    </Stack>
                  )}
                  {format === 'a4' && !a4Fits && (
                    <Alert.Root status="error">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Description>
                          These label dimensions, margins, spacing, and columns do not fit on an A4 page.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  )}
                  {!validQuantity && (
                    <Alert.Root status="error">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Description>
                          Enter a positive whole number no greater than {MAX_LABELS}.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  )}
                  <Field.Root>
                    <Field.Label>Optional label content</Field.Label>
                    <HStack gap="5" wrap="wrap">
                      <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
                        <input
                          id="barcode-label-name"
                          type="checkbox"
                          className="size-4 shrink-0 cursor-pointer accent-foreground"
                          checked={labelContent.name}
                          onChange={(event) => updateLabelContent('name', event.currentTarget.checked)}
                        />
                        Product name
                      </label>
                      <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
                        <input
                          id="barcode-label-rrp"
                          type="checkbox"
                          className="size-4 shrink-0 cursor-pointer accent-foreground"
                          checked={labelContent.rrp}
                          onChange={(event) => updateLabelContent('rrp', event.currentTarget.checked)}
                        />
                        RRP
                      </label>
                      <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
                        <input
                          id="barcode-label-selling-price"
                          type="checkbox"
                          className="size-4 shrink-0 cursor-pointer accent-foreground"
                          checked={labelContent.sellingPrice}
                          onChange={(event) => updateLabelContent('sellingPrice', event.currentTarget.checked)}
                        />
                        Selling price
                      </label>
                    </HStack>
                  </Field.Root>
                  <Stack gap="2">
                    <Text fontWeight="semibold">Preview · first {format === 'a4' ? 'sheet' : 'label'}</Text>
                    <div className="max-h-[55vh] overflow-auto rounded-md border bg-muted p-3">
                      {format === 'a4' ? (
                        <div
                          className="barcode-sheet-preview"
                          style={{
                            width: '210mm',
                            minHeight: '297mm',
                            padding: `${margin}mm`,
                            display: 'grid',
                            gridTemplateColumns: `repeat(${columns}, ${labelWidth}mm)`,
                            gridAutoRows: `${labelHeight}mm`,
                            gap: `${spacing}mm`,
                            boxSizing: 'border-box',
                            background: 'white',
                            transform: 'scale(.55)',
                            transformOrigin: 'top left',
                            marginBottom: '-130mm',
                          }}
                        >
                          {Array.from({ length: Math.min(quantity, Math.max(pageCapacity, 1)) }, label)}
                        </div>
                      ) : (
                        <div
                          className="barcode-thermal-page"
                          style={{
                            width: `${thermal.width}mm`,
                            height: `${thermal.height}mm`,
                            padding: '1mm',
                            boxSizing: 'border-box',
                            background: 'white',
                          }}
                        >
                          {label()}
                        </div>
                      )}
                    </div>
                    <Text fontSize="xs" color="fg.muted">
                      {format === 'a4'
                        ? `${pageCapacity} labels per A4 sheet · ${pages.length} sheet${pages.length === 1 ? '' : 's'} total`
                        : `${quantity} physical label${quantity === 1 ? '' : 's'} · ${thermal.width} × ${thermal.height} mm each`}
                    </Text>
                  </Stack>
                </Stack>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {product?.barcode && (
                <Button onClick={handlePrint} disabled={!svg || !validQuantity || (format === 'a4' && !a4Fits)}>
                  <Printer size={16} />
                  Print labels
                </Button>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
      {open &&
        product?.barcode &&
        svg &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <style>{printCss}</style>
            <div id="barcode-print-root" aria-hidden="true">
              {pages.map((page, pageIndex) =>
                format === 'a4' ? (
                  <div className="barcode-sheet" key={pageIndex}>
                    {page.map((_, labelIndex) => (
                      <div className="barcode-sheet-slot" key={labelIndex}>
                        {label()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="barcode-thermal-page" key={pageIndex}>
                    {label()}
                  </div>
                ),
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
