import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Layers3,
  Package,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Card as ChakraCard, Grid, HStack, Heading, Text } from '@chakra-ui/react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'
import { QrImageUploader } from '@/components/common/QrImageUploader'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Skeleton,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSet,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/catalog/CatalogUi'
import {
  createBrand,
  createCategory,
  createProduct,
  deleteBrand,
  deleteCategory,
  deleteProduct,
  getBrands,
  getCategoriesPage,
  getProducts,
  removeProductImage,
  reorderProductImages,
  requestCatalogMediaUploadUrls,
  updateBrand,
  updateCategory,
  updateProduct,
  uploadMediaFile,
} from '@/api/endpoints/catalog'
import type { CatalogBrand, CatalogCategory, CatalogProduct, ProductPayload } from '@/api/endpoints/catalog'
import { getSuppliers, type SupplierOption } from '@/api/endpoints/purchases'
import { getInventorySummary, type InventorySummary } from '@/api/endpoints/inventory'

type Section = 'products' | 'categories' | 'brands'
const pageSize = 20
const imageTypes = ['image/jpeg', 'image/png', 'image/webp']

function useDebounced(value: string) {
  const [result, setResult] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setResult(value), 300)
    return () => window.clearTimeout(timer)
  }, [value])
  return result
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="my-4 flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <span className="flex items-center gap-2">
        <AlertCircle className="size-4 shrink-0 text-destructive" />
        {message}
      </span>
      <Button className="ml-3" size="sm" variant="outline" onClick={retry}>
        <AlertCircle />
        Retry
      </Button>
    </div>
  )
}

function StatRow({ stats }: { stats: Array<{ label: string; value: string; detail?: string; icon: typeof Package }> }) {
  return (
    <Grid mb="7" gap="4" templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }}>
      {stats.map(({ label, value, detail, icon: Icon }) => (
        <ChakraCard.Root key={label} variant="outline" minW="0">
          <ChakraCard.Header>
            <HStack justify="space-between" align="center">
              <ChakraCard.Title fontSize="sm" fontWeight="600" truncate>
                {label}
              </ChakraCard.Title>
              <Icon size={17} />
            </HStack>
          </ChakraCard.Header>
          <ChakraCard.Body pt="0">
            <Heading size="lg">{value}</Heading>
            <Text fontSize="xs" color="muted">
              {detail}
            </Text>
          </ChakraCard.Body>
        </ChakraCard.Root>
      ))}
    </Grid>
  )
}

function useCatalogStats() {
  const [stats, setStats] = useState<InventorySummary>()
  useEffect(() => {
    void getInventorySummary()
      .then(setStats)
      .catch(() => setStats(undefined))
  }, [])
  return stats
}

type UploadState = {
  file: File
  preview: string
  status: 'queued' | 'uploading' | 'uploaded' | 'error'
  message?: string
}

function ImageDropzone({
  multiple,
  initialImages = [],
  initialImageKeys = [],
  onChange,
  onRemoveExisting,
  onMoveExisting,
  statusByIndex = {},
}: {
  multiple?: boolean
  initialImages?: string[]
  initialImageKeys?: string[]
  onChange: (files: File[]) => void
  onRemoveExisting?: (key: string) => void
  onMoveExisting?: (index: number, direction: 'left' | 'right') => void
  statusByIndex?: Record<number, 'uploading' | 'uploaded' | 'error'>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<UploadState[]>([])
  const acceptFiles = (incoming: File[]) => {
    const valid = incoming.filter((file) => imageTypes.includes(file.type))
    const selected = multiple ? valid.slice(0, 10) : valid.slice(0, 1)
    setFiles(selected.map((file) => ({ file, preview: URL.createObjectURL(file), status: 'queued' })))
    onChange(selected)
  }
  return (
    <Field>
      <FieldLabel>Images</FieldLabel>
      <div className="space-y-3">
        <button
          type="button"
          className="flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-7 text-center text-sm transition-colors hover:border-primary hover:bg-muted/40"
          onClick={() => input.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            acceptFiles(Array.from(event.dataTransfer.files))
          }}
        >
          <Upload className="size-5 text-muted-foreground" />
          <span className="font-medium">Drop {multiple ? 'images' : 'an image'} here or browse</span>
          <span className="text-xs text-muted-foreground">JPEG, PNG or WebP{multiple ? ' · Up to 10 images' : ''}</span>
        </button>
        <input
          ref={input}
          hidden
          type="file"
          accept={imageTypes.join(',')}
          multiple={multiple}
          onChange={(event) => acceptFiles(Array.from(event.target.files ?? []))}
        />
        {(files.length > 0 || initialImages.length > 0) && (
          <div className="mt-2 grid grid-cols-2 gap-4 p-1 sm:grid-cols-4">
            {initialImages.map((src, index) => (
              <div key={src} className="relative m-1 aspect-square overflow-hidden rounded-lg border bg-muted p-1">
                <img src={src} alt="" className="size-full rounded-md object-cover" />
                {onRemoveExisting && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-xs"
                    className="absolute right-1 top-1"
                    aria-label="Remove image"
                    onClick={() => onRemoveExisting(initialImageKeys[index] ?? src)}
                  >
                    <X />
                  </Button>
                )}
                {onMoveExisting && (
                  <div className="absolute inset-x-1 bottom-1 flex justify-between">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-xs"
                      disabled={index === 0}
                      aria-label="Move image left"
                      onClick={() => onMoveExisting(index, 'left')}
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-xs"
                      disabled={index === initialImages.length - 1}
                      aria-label="Move image right"
                      onClick={() => onMoveExisting(index, 'right')}
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {files.map((item, index) => {
              const status = statusByIndex[index] ?? item.status
              return (
                <div key={item.preview} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                  <img src={item.preview} alt="" className="size-full object-cover" />
                  {status === 'uploading' && (
                    <div className="absolute inset-0 grid place-items-center bg-background/70">
                      <Skeleton className="size-6 rounded-full" />
                    </div>
                  )}
                  {status === 'error' && (
                    <div className="absolute inset-x-0 bottom-0 bg-destructive/90 px-1 py-0.5 text-center text-[10px] text-destructive-foreground">
                      Upload failed
                    </div>
                  )}
                  {status === 'uploaded' && (
                    <div className="absolute inset-x-0 bottom-0 bg-emerald-600/90 px-1 py-0.5 text-center text-[10px] text-white">
                      Uploaded
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Field>
  )
}

async function stageFiles(
  resource: 'PRODUCT_IMAGE' | 'BRAND_LOGO' | 'CATEGORY_LOGO',
  files: File[],
  setStatus: (index: number, status: 'uploading' | 'uploaded' | 'error') => void,
) {
  if (!files.length) return []
  const uploads = await requestCatalogMediaUploadUrls(
    resource,
    files.map((file) => file.type),
  )
  return Promise.all(
    uploads.uploads.map(async (upload, index) => {
      setStatus(index, 'uploading')
      try {
        await uploadMediaFile(upload, files[index])
        setStatus(index, 'uploaded')
        return upload.key
      } catch (cause) {
        setStatus(index, 'error')
        throw cause
      }
    }),
  )
}

function ProductDialog({
  initial,
  categories,
  brands,
  suppliers,
  open,
  onOpenChange,
  onSaved,
}: {
  initial?: CatalogProduct
  categories: CatalogCategory[]
  brands: CatalogBrand[]
  suppliers: SupplierOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ProductPayload>({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    brandId: null,
    supplierId: null,
    description: '',
    rrp: 0,
    sellingPrice: 0,
    purchaseCost: 0,
    stockQuantity: 0,
    lowStockThreshold: 0,
  })
  const [stagedKeys, setStagedKeys] = useState<string[]>([])
  const [existingImages, setExistingImages] = useState<string[]>(initial?.imageKeys ?? [])
  const [uploadStatus, setUploadStatus] = useState<Record<number, 'uploading' | 'uploaded' | 'error'>>({})
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setForm({
      name: initial?.name ?? '',
      sku: initial?.sku ?? '',
      barcode: initial?.barcode ?? '',
      categoryId: initial?.categoryId ?? '',
      brandId: initial?.brand?.id ?? null,
      supplierId: initial?.supplier?.id ?? null,
      description: initial?.description ?? '',
      rrp: initial?.rrp ?? 0,
      sellingPrice: initial?.sellingPrice ?? 0,
      purchaseCost: initial?.purchaseCost ?? 0,
      stockQuantity: initial?.stockQuantity ?? 0,
      lowStockThreshold: initial?.lowStockThreshold ?? 0,
      imageKeys: initial?.imageKeys ?? [],
    })
    setExistingImages(initial?.imageKeys ?? [])
    setStagedKeys([])
    setUploadStatus({})
    setUploading(false)
    setError('')
  }, [initial, open])
  const set = <K extends keyof ProductPayload>(key: K, value: ProductPayload[K]) =>
    setForm((current) => ({ ...current, [key]: value }))
  const submit = async () => {
    if (!form.name.trim() || !form.sku.trim() || !form.categoryId) {
      setError('Product name, SKU, and category are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (uploading) {
        setError('Please wait for image uploads to finish.')
        return
      }
      const payload = { ...form, imageKeys: [...existingImages, ...stagedKeys] }
      if (initial) await updateProduct(initial.id, payload)
      else await createProduct(payload)
      onOpenChange(false)
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Product could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const removeExisting = async (key: string) => {
    if (!initial) return
    try {
      const result = await removeProductImage(initial.id, key)
      setExistingImages(result.imageKeys)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Image could not be removed.')
    }
  }
  const moveExisting = async (index: number, direction: 'left' | 'right') => {
    if (!initial) return
    const next = [...existingImages]
    const target = direction === 'left' ? index - 1 : index + 1
    ;[next[index], next[target]] = [next[target], next[index]]
    try {
      await reorderProductImages(initial.id, next)
      setExistingImages(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Image order could not be saved.')
    }
  }
  const imageUrls = initial?.imageUrls ?? initial?.imageKeys ?? []
  const handleFiles = async (selected: File[]) => {
    setStagedKeys([])
    setUploading(Boolean(selected.length))
    setError('')
    try {
      setStagedKeys(
        await stageFiles('PRODUCT_IMAGE', selected, (index, status) =>
          setUploadStatus((current) => ({ ...current, [index]: status })),
        ),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Image upload failed.')
    } finally {
      setUploading(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {' '}
      <DialogContent className="max-h-[92vh] overflow-y-auto p-8 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit product' : 'Add product'}</DialogTitle>
          <DialogDescription>Keep product information, pricing, inventory and media together.</DialogDescription>
        </DialogHeader>
        <FieldSet className="gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Product name</FieldLabel>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Wireless Mouse"
              />
            </Field>
            <Field>
              <FieldLabel>SKU</FieldLabel>
              <Input value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="SKU-001" />
            </Field>
            <Field>
              <FieldLabel>Barcode</FieldLabel>
              <Input value={form.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Category</FieldLabel>
              <Select value={form.categoryId} onValueChange={(value) => set('categoryId', value ?? '')}>
                <SelectTrigger>
                  <span>{categories.find((item) => item.id === form.categoryId)?.name ?? 'Select category'}</span>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Brand</FieldLabel>
              <Select value={form.brandId ?? ''} onValueChange={(value) => set('brandId', value || null)}>
                <SelectTrigger>
                  <span>{brands.find((item) => item.id === form.brandId)?.name ?? 'No brand'}</span>
                </SelectTrigger>{' '}
                <SelectContent>
                  {brands.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Supplier</FieldLabel>
              <Select value={form.supplierId ?? ''} onValueChange={(value) => set('supplierId', value || null)}>
                <SelectTrigger>
                  <span>{suppliers.find((item) => item.id === form.supplierId)?.name ?? 'No supplier'}</span>
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short product description"
            />
          </Field>
          <Separator />
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Package />
              Pricing and stock
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>RRP</FieldLabel>
                <Input type="number" min="0" value={form.rrp} onChange={(e) => set('rrp', Number(e.target.value))} />
              </Field>
              <Field>
                <FieldLabel>Selling price</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  value={form.sellingPrice}
                  onChange={(e) => set('sellingPrice', Number(e.target.value))}
                />
              </Field>{' '}
              <Field>
                <FieldLabel>Purchase cost</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  value={form.purchaseCost}
                  onChange={(e) => set('purchaseCost', Number(e.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel>Initial stock count</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  value={form.stockQuantity ?? 0}
                  onChange={(e) => set('stockQuantity', Number(e.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel>Low-stock threshold</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  value={form.lowStockThreshold}
                  onChange={(e) => set('lowStockThreshold', Number(e.target.value))}
                />
                <FieldDescription>Stock is managed through inventory.</FieldDescription>
              </Field>
            </div>
          </div>
          <Separator />
          <QrImageUploader
            label="Product images"
            description="Upload product photos directly or scan the QR code to upload from phone."
            purpose="PRODUCT_IMAGE"
            multiple
            value={existingImages.map((key, i) => ({
              key,
              previewUrl: imageUrls[i] || '',
            }))}
            onChange={(images) => {
              setExistingImages(images.map((img) => img.key))
              setImageUrls(images.map((img) => img.previewUrl))
            }}
            onRemove={(idx) => removeExisting(idx)}
            onManualFileSelect={(selected) => {
              void handleFiles(Array.from(selected))
            }}
            isUploadingManual={uploading}
          />
          {error && <FieldError>{error}</FieldError>}
        </FieldSet>
        <DialogFooter>
          {' '}
          <Button
            variant="outline"
            className="transition-all hover:-translate-y-0.5 hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-foreground text-background transition-all hover:-translate-y-0.5 hover:bg-foreground/80 hover:shadow-md"
            onClick={submit}
            disabled={saving || uploading}
          >
            {saving ? 'Saving…' : initial ? 'Save product' : 'Create product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EntityDialog({
  kind,
  initial,
  categories,
  open,
  onOpenChange,
  onSaved,
}: {
  kind: 'category' | 'brand'
  initial?: CatalogCategory | CatalogBrand
  categories?: CatalogCategory[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [logoKey, setLogoKey] = useState<string>()
  const [uploadStatus, setUploadStatus] = useState<Record<number, 'uploading' | 'uploaded' | 'error'>>({})
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setName(initial?.name ?? '')
    setDescription(initial?.description ?? '')
    setParentId(kind === 'category' ? ((initial as CatalogCategory | undefined)?.parentId ?? null) : null)
    setLogoKey(initial?.logoKey ?? undefined)
    setUploadStatus({})
    setUploading(false)
    setError('')
  }, [initial, open, kind])
  const handleFiles = async (selected: File[]) => {
    setLogoKey(undefined)
    setUploading(Boolean(selected.length))
    setError('')
    try {
      const keys = await stageFiles(
        kind === 'category' ? 'CATEGORY_LOGO' : 'BRAND_LOGO',
        selected.slice(0, 1),
        (index, status) => setUploadStatus((current) => ({ ...current, [index]: status })),
      )
      setLogoKey(keys[0])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Logo upload failed.')
    } finally {
      setUploading(false)
    }
  }
  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (uploading) {
      setError('Please wait for the logo upload to finish.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (kind === 'category') {
        if (initial) await updateCategory(initial.id, { name, description, parentId, logoKey: logoKey ?? null })
        else await createCategory({ name, description, parentId, logoKey: logoKey ?? null })
      } else if (initial) await updateBrand(initial.id, { name, description, logoKey: logoKey ?? null })
      else await createBrand({ name, description, logoKey: logoKey ?? null })
      onOpenChange(false)
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not save ${kind}.`)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {' '}
      <DialogContent className="max-h-[90vh] overflow-y-auto p-8 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${kind}` : `Add ${kind}`}</DialogTitle>
          <DialogDescription>Create a reusable {kind} for your catalog.</DialogDescription>
        </DialogHeader>
        <FieldSet className="gap-5">
          <Field>
            <FieldLabel>{kind === 'category' ? 'Category name' : 'Brand name'}</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {kind === 'category' && (
            <Field>
              <FieldLabel>Parent category</FieldLabel>
              <Select value={parentId ?? ''} onValueChange={(value) => setParentId(value || null)}>
                {' '}
                <SelectTrigger>
                  <span>
                    {(categories ?? []).find((category) => category.id === parentId)?.name ?? 'No parent category'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No parent category</SelectItem>
                  {(categories ?? [])
                    .filter((category) => category.id !== initial?.id)
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field>
            <FieldLabel>Description</FieldLabel>
            <Textarea value={description ?? ''} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <QrImageUploader
            label={kind === 'category' ? 'Category logo' : 'Brand logo'}
            description={`Upload ${kind} logo directly or scan QR code to upload from phone.`}
            purpose={kind === 'category' ? 'CATEGORY_IMAGE' : 'BRAND_LOGO'}
            multiple={false}
            value={logoKey ? [{ key: logoKey, previewUrl: initial?.logoUrl || '' }] : []}
            onChange={(images) => {
              if (images[0]) {
                setLogoKey(images[0].key)
              } else {
                setLogoKey(undefined)
              }
            }}
            onRemove={() => setLogoKey(undefined)}
            onManualFileSelect={(selected) => {
              void handleFiles(Array.from(selected))
            }}
            isUploadingManual={uploading}
          />
          {error && <FieldError>{error}</FieldError>}
        </FieldSet>
        <DialogFooter>
          {' '}
          <Button
            variant="outline"
            className="transition-all hover:-translate-y-0.5 hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-foreground text-background transition-all hover:-translate-y-0.5 hover:bg-foreground/80 hover:shadow-md"
            onClick={submit}
            disabled={saving || uploading}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmDelete({
  target,
  onOpenChange,
  onConfirm,
}: {
  target?: { type: string; name: string }
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {target?.type}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete “{target?.name}”. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            <Trash2 />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <HStack gap="1" justify="flex-end">
      <Button variant="ghost" size="icon-xs" aria-label="Edit" onClick={onEdit}>
        <Pencil size={14} />
      </Button>
      <Button variant="ghost" size="icon-xs" colorPalette="red" aria-label="Delete" onClick={onDelete}>
        <Trash2 size={14} />
      </Button>
    </HStack>
  )
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <TableHead>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 px-2 font-semibold transition-all hover:-translate-y-0.5 hover:bg-foreground hover:text-background"
        onClick={onClick}
      >
        {label}
        {active ? (
          direction === 'asc' ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 text-muted-foreground" />
        )}
      </Button>
    </TableHead>
  )
}

function stockClass(quantity: number, threshold: number) {
  if (quantity <= 0) return 'font-semibold text-red-600'
  if (quantity <= threshold) return 'font-semibold text-yellow-600'
  return 'font-medium text-foreground'
}

function ProductsSection() {
  const [items, setItems] = useState<CatalogProduct[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [brands, setBrands] = useState<CatalogBrand[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [search, setSearch] = useState('')
  const query = useDebounced(search)
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [sortBy, setSortBy] = useState<'name' | 'sellingPrice' | 'stockQuantity' | 'createdAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<{ open: boolean; item?: CatalogProduct }>({ open: false })
  const [remove, setRemove] = useState<CatalogProduct>()
  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([
      getProducts({
        page,
        limit: pageSize,
        search: query,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        sortBy,
        sortOrder,
      }),
      getCategoriesPage({ page: 1, limit: 100 }),
      getBrands({ page: 1, limit: 100 }),
      getSuppliers({ page: 1, limit: 100 }),
    ])
      .then(([products, categoryResult, brandResult, supplierResult]) => {
        setItems(products.items)
        setTotalPages(products.pagination.totalPages)
        setTotalProducts(products.pagination.total)
        setCategories(categoryResult.items)
        setBrands(brandResult.items)
        setSuppliers(supplierResult.items)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Products could not be loaded.'))
      .finally(() => setLoading(false))
  }
  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) setSortOrder((value) => (value === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }
  useEffect(() => {
    setPage(1)
  }, [query, categoryId, brandId])
  useEffect(load, [page, query, categoryId, brandId, sortBy, sortOrder])
  const deleteItem = async () => {
    if (!remove) return
    try {
      await deleteProduct(remove.id)
      setRemove(undefined)
      load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Product could not be deleted.')
    }
  }
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            pl="9"
            h="10"
            placeholder="Search products by name, SKU, barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {categories.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Select value={brandId} onValueChange={(value) => setBrandId(value ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="All brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All brands</SelectItem>
              {brands.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true })}>
          <Plus />
          Add product
        </Button>
      </div>
      {error ? (
        <ErrorState message={error} retry={load} />
      ) : (
        <Card className="w-full overflow-hidden">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[1120px] text-xs">
              <TableHeader>
                <TableRow>
                  <SortHeader
                    label="Product"
                    active={sortBy === 'name'}
                    direction={sortOrder}
                    onClick={() => toggleSort('name')}
                  />
                  <TableHead>SKU</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Purchase</TableHead>
                  <SortHeader
                    label="Selling"
                    active={sortBy === 'sellingPrice'}
                    direction={sortOrder}
                    onClick={() => toggleSort('sellingPrice')}
                  />
                  <SortHeader
                    label="Stock count"
                    active={sortBy === 'stockQuantity'}
                    direction={sortOrder}
                    onClick={() => toggleSort('stockQuantity')}
                  />
                  <TableHead>Supplier</TableHead>
                  <TableHead className="sticky right-0 z-10 w-20 bg-background text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }, (_, row) => (
                      <TableRow key={row}>
                        {Array.from({ length: 9 }, (_, cell) => (
                          <TableCell key={cell}>
                            <Skeleton className="h-3 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted p-1">
                              {item.imageUrls?.[0] ? (
                                <img src={item.imageUrls[0]} alt="" className="size-full object-contain" />
                              ) : (
                                <ImageIcon className="size-4 text-muted-foreground" />
                              )}
                            </div>
                            <span className="font-medium">{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell>{item.brand?.name ?? '—'}</TableCell>
                        <TableCell>
                          {item.category?.name ??
                            categories.find((category) => category.id === item.categoryId)?.name ??
                            '—'}
                        </TableCell>
                        <TableCell>${(item.purchaseCost ?? 0).toFixed(2)}</TableCell>
                        <TableCell>${item.sellingPrice.toFixed(2)}</TableCell>
                        <TableCell className={stockClass(item.stockQuantity, item.lowStockThreshold)}>
                          {item.stockQuantity}
                        </TableCell>
                        <TableCell>{item.supplier?.name ?? '—'}</TableCell>
                        <TableCell className="sticky right-0 z-10 bg-background">
                          <Actions onEdit={() => setDialog({ open: true, item })} onDelete={() => setRemove(item)} />
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-xs text-muted-foreground">
            Showing {items.length} of {totalProducts} products
            <span className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </span>
          </div>
        </Card>
      )}{' '}
      <ProductDialog
        initial={dialog.item}
        categories={categories}
        brands={brands}
        suppliers={suppliers}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        onSaved={load}
      />
      <ConfirmDelete
        target={remove ? { type: 'product', name: remove.name } : undefined}
        onOpenChange={(open) => !open && setRemove(undefined)}
        onConfirm={deleteItem}
      />
    </>
  )
}

function LegacyEntitySection({ kind }: { kind: 'category' | 'brand' }) {
  const [items, setItems] = useState<(CatalogCategory | CatalogBrand)[]>([])
  const [search, setSearch] = useState('')
  const query = useDebounced(search)
  const [totalCount, setTotalCount] = useState(0)
  const [sortBy, setSortBy] = useState<'name' | 'createdAt'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<{ open: boolean; item?: CatalogCategory | CatalogBrand }>({ open: false })
  const [remove, setRemove] = useState<CatalogCategory | CatalogBrand>()
  const [selectedBrand, setSelectedBrand] = useState<CatalogBrand>()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const summary = useCatalogStats()
  const load = () => {
    setLoading(true)
    setError('')
    const request =
      kind === 'category'
        ? getCategoriesPage({ page: 1, limit: 100, search: query, includeChildren: true })
        : getBrands({ page: 1, limit: 100, search: query })
    request
      .then((result) => {
        setItems(result.items)
        setTotalCount(result.pagination.total)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : `Could not load ${kind}s.`))
      .finally(() => setLoading(false))
  }
  useEffect(load, [kind, query, sortBy, sortOrder])
  const removeItem = async () => {
    if (!remove) return
    try {
      if (kind === 'category') await deleteCategory(remove.id)
      else await deleteBrand(remove.id)
      setRemove(undefined)
      load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not delete ${kind}.`)
    }
  }
  const rows = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const result = a.name.localeCompare(b.name)
      return sortOrder === 'asc' ? result : -result
    })
    return kind === 'category'
      ? (sorted as CatalogCategory[]).flatMap((item) =>
          expanded.has(item.id)
            ? [item, ...(item.children ?? []).map((child) => ({ ...child, name: `↳ ${child.name}` }))]
            : [item],
        )
      : sorted
  }, [items, expanded, kind, sortOrder])
  const toggleSort = (column: 'name' | 'createdAt') => {
    if (sortBy === column) setSortOrder((value) => (value === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }
  return (
    <>
      <StatRow
        stats={[
          {
            label: kind === 'category' ? 'Total categories' : 'Total brands',
            value: String(totalCount),
            icon: kind === 'category' ? Tags : Layers3,
          },
          { label: 'Total products', value: String(summary?.totalProducts ?? '—'), icon: Package },
          { label: 'Low stock products', value: String(summary?.lowStockProducts ?? '—'), icon: AlertCircle },
          { label: 'Inventory value', value: summary ? `$${summary.inventoryValue.toFixed(2)}` : '—', icon: Package },
        ]}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />{' '}
          <Input
            pl="8"
            h="9"
            placeholder={`Search ${kind === 'category' ? 'categories' : 'brands'}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>{' '}
        <Button
          className="transition-all hover:-translate-y-0.5 hover:shadow-md"
          size="sm"
          onClick={() => setDialog({ open: true })}
        >
          <Plus />
          Add {kind}
        </Button>
      </div>
      {error ? (
        <ErrorState message={error} retry={load} />
      ) : (
        <Card className="w-full overflow-hidden p-1">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[700px] text-xs [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3">
              <TableHeader>
                <TableRow>
                  <SortHeader
                    label={kind === 'category' ? 'Name' : 'Brand'}
                    active={sortBy === 'name'}
                    direction={sortOrder}
                    onClick={() => toggleSort('name')}
                  />
                  <TableHead className="px-4 py-3">{kind === 'brand' ? 'Products' : 'Description'}</TableHead>
                  <TableHead className="px-4 py-3">Status</TableHead>
                  <TableHead className="sticky right-0 z-10 w-20 bg-background px-4 py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 6 }, (_, row) => (
                      <TableRow key={row}>
                        {Array.from({ length: 4 }, (_, cell) => (
                          <TableCell key={cell}>
                            <Skeleton className="h-3 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : rows.map((item) => {
                      const category = item as CatalogCategory
                      const brand = item as CatalogBrand
                      const hasChildren = kind === 'category' && Boolean(category.children?.length)
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {hasChildren && (
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={expanded.has(item.id) ? 'Collapse category' : 'Expand category'}
                                  onClick={() =>
                                    setExpanded((current) => {
                                      const next = new Set(current)
                                      expanded.has(item.id) ? next.delete(item.id) : next.add(item.id)
                                      return next
                                    })
                                  }
                                >
                                  {expanded.has(item.id) ? <ChevronDown /> : <ChevronRight />}
                                </Button>
                              )}
                              {kind === 'brand' && (
                                <div className="grid size-8 place-items-center rounded-full bg-muted p-1 text-xs">
                                  {item.name.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <Button
                                variant={kind === 'brand' ? 'link' : 'ghost'}
                                size="sm"
                                className="h-auto justify-start p-0 font-medium"
                                onClick={() => kind === 'brand' && setSelectedBrand(brand)}
                              >
                                {item.name}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {kind === 'brand' ? (brand.productCount ?? '—') : item.description || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.isActive === false ? 'secondary' : 'outline'}>
                              {item.isActive === false ? 'Inactive' : 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell className="sticky right-0 z-10 bg-background">
                            <Actions onEdit={() => setDialog({ open: true, item })} onDelete={() => setRemove(item)} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}{' '}
      <EntityDialog
        kind={kind}
        initial={dialog.item}
        categories={kind === 'category' ? (items as CatalogCategory[]) : undefined}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        onSaved={load}
      />
      <ConfirmDelete
        target={remove ? { type: kind, name: remove.name } : undefined}
        onOpenChange={(open) => !open && setRemove(undefined)}
        onConfirm={removeItem}
      />
      <Sheet open={Boolean(selectedBrand)} onOpenChange={(open) => !open && setSelectedBrand(undefined)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedBrand?.name}</SheetTitle>
            <SheetDescription>{selectedBrand?.description || 'Brand details'}</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 p-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Products</CardTitle>
              </CardHeader>
              <CardContent>
                <strong>{selectedBrand?.productCount ?? '—'}</strong>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={selectedBrand?.isActive === false ? 'secondary' : 'outline'}>
                  {selectedBrand?.isActive === false ? 'Inactive' : 'Active'}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

void LegacyEntitySection

function EntitySection({ kind }: { kind: 'category' | 'brand' }) {
  const [items, setItems] = useState<(CatalogCategory | CatalogBrand)[]>([])
  const [search, setSearch] = useState('')
  const query = useDebounced(search)
  const [totalCount, setTotalCount] = useState(0)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<{ open: boolean; item?: CatalogCategory | CatalogBrand }>({ open: false })
  const [remove, setRemove] = useState<CatalogCategory | CatalogBrand>()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const summary = useCatalogStats()

  const load = () => {
    setLoading(true)
    setError('')
    const request =
      kind === 'category'
        ? getCategoriesPage({ page: 1, limit: 100, search: query, includeChildren: true })
        : getBrands({ page: 1, limit: 100, search: query })
    request
      .then((result) => {
        setItems(result.items)
        setTotalCount(result.pagination.total)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : `Could not load ${kind}s.`))
      .finally(() => setLoading(false))
  }

  useEffect(load, [kind, query])

  const rows = useMemo(() => {
    const compare = (a: { name: string }, b: { name: string }) => {
      const result = a.name.localeCompare(b.name)
      return sortOrder === 'asc' ? result : -result
    }
    if (kind !== 'category') return [...items].sort(compare).map((item) => ({ item, depth: 0 }))

    const byId = new Map<string, CatalogCategory>()
    const addCategory = (category: CatalogCategory) => {
      const current = byId.get(category.id)
      byId.set(category.id, { ...current, ...category, children: undefined })
      category.children?.forEach(addCategory)
    }
    ;(items as CatalogCategory[]).forEach(addCategory)

    const childrenByParent = new Map<string, CatalogCategory[]>()
    byId.forEach((category) => {
      if (!category.parentId) return
      const children = childrenByParent.get(category.parentId) ?? []
      children.push(category)
      childrenByParent.set(category.parentId, children)
    })
    byId.forEach((category) => {
      const children = childrenByParent.get(category.id)
      if (children?.length) category.children = children.sort(compare)
    })

    const roots = [...byId.values()]
      .filter((category) => !category.parentId || !byId.has(category.parentId))
      .sort(compare)
    const flatten = (categories: CatalogCategory[], depth = 0): Array<{ item: CatalogCategory; depth: number }> =>
      categories.flatMap((category) => [
        { item: category, depth },
        ...(expanded.has(category.id) ? flatten(category.children ?? [], depth + 1) : []),
      ])
    return flatten(roots)
  }, [items, expanded, kind, sortOrder])

  const removeItem = async () => {
    if (!remove) return
    try {
      if (kind === 'category') await deleteCategory(remove.id)
      else await deleteBrand(remove.id)
      setRemove(undefined)
      load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not delete ${kind}.`)
    }
  }

  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <>
      <StatRow
        stats={[
          {
            label: kind === 'category' ? 'Total categories' : 'Total brands',
            value: String(totalCount),
            detail: kind === 'category' ? 'active product groupings' : 'catalog brand records',
            icon: kind === 'category' ? Tags : Layers3,
          },
          {
            label: 'Total products',
            value: String(summary?.totalProducts ?? '—'),
            detail: 'products across the catalog',
            icon: Package,
          },
          {
            label: 'Low stock products',
            value: String(summary?.lowStockProducts ?? '—'),
            detail: 'at or below reorder level',
            icon: AlertCircle,
          },
          {
            label: 'Inventory value',
            value: summary ? `$${summary.inventoryValue.toFixed(2)}` : '—',
            detail: 'stock quantity × average cost',
            icon: Package,
          },
        ]}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <Input
            pl="8"
            h="9"
            placeholder={`Search ${kind === 'category' ? 'categories' : 'brands'}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true })}>
          <Plus />
          Add {kind}
        </Button>
      </div>
      {error ? (
        <ErrorState message={error} retry={load} />
      ) : (
        <Card className="w-full overflow-hidden p-1">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[760px] text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Logo</TableHead>{' '}
                  <SortHeader
                    label={kind === 'category' ? 'Name' : 'Brand'}
                    active={true}
                    direction={sortOrder}
                    onClick={() => setSortOrder((value) => (value === 'asc' ? 'desc' : 'asc'))}
                  />
                  <TableHead>{kind === 'brand' ? 'Products' : 'Description'}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="sticky right-0 z-10 w-20 bg-background text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 6 }, (_, row) => (
                      <TableRow key={row}>
                        {Array.from({ length: 5 }, (_, cell) => (
                          <TableCell key={cell}>
                            <Skeleton className="h-3 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : rows.map(({ item, depth }) => {
                      const category = item as CatalogCategory
                      const brand = item as CatalogBrand
                      const hasChildren = kind === 'category' && Boolean(category.children?.length)
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="grid size-9 place-items-center overflow-hidden rounded-md border bg-muted">
                              {item.logoUrl ? (
                                <img
                                  src={item.logoUrl}
                                  alt={`${item.name} logo`}
                                  className="size-full object-contain"
                                />
                              ) : (
                                <span className="text-xs font-semibold">{item.name.slice(0, 1).toUpperCase()}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 24}px` }}>
                              {hasChildren ? (
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={expanded.has(item.id) ? 'Collapse category' : 'Expand category'}
                                  onClick={() => toggleExpanded(item.id)}
                                >
                                  {expanded.has(item.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                </Button>
                              ) : (
                                <span className="inline-block w-6" />
                              )}
                              <Button
                                variant={kind === 'brand' ? 'link' : 'ghost'}
                                size="sm"
                                className="h-auto justify-start p-0 font-medium"
                                onClick={() => kind === 'brand' && setDialog({ open: true, item })}
                              >
                                {item.name}
                              </Button>
                              {hasChildren && (
                                <Badge variant="outline" className="ml-2">
                                  {category.children?.length} subcategories
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {kind === 'brand' ? (brand.productCount ?? '—') : item.description || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.isActive === false ? 'secondary' : 'outline'}>
                              {item.isActive === false ? 'Inactive' : 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell className="sticky right-0 z-10 bg-background">
                            <Actions onEdit={() => setDialog({ open: true, item })} onDelete={() => setRemove(item)} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
      <EntityDialog
        kind={kind}
        initial={dialog.item}
        categories={kind === 'category' ? (items as CatalogCategory[]) : undefined}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        onSaved={load}
      />
      <ConfirmDelete
        target={remove ? { type: kind, name: remove.name } : undefined}
        onOpenChange={(open) => !open && setRemove(undefined)}
        onConfirm={removeItem}
      />
    </>
  )
}

export function CatalogPage() {
  const location = useLocation()
  const section: Section = location.pathname.endsWith('/categories')
    ? 'categories'
    : location.pathname.endsWith('/brands')
      ? 'brands'
      : 'products'
  const title = section === 'products' ? 'Products' : section === 'categories' ? 'Categories' : 'Brands'
  const description =
    section === 'products'
      ? 'Manage your products, pricing, stock and catalog information.'
      : section === 'categories'
        ? 'Organize your products into categories and subcategories.'
        : 'Manage product brands and review their catalog presence.'
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      {section === 'products' ? (
        <ProductsSection />
      ) : (
        <EntitySection kind={section === 'categories' ? 'category' : 'brand'} />
      )}
    </PageContainer>
  )
}
