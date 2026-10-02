import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Image as ImageIcon, Layers3, MoreHorizontal, Package, Pencil, Plus, Search, Tags, Trash2, Upload, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Field, FieldDescription, FieldError, FieldLabel, FieldSet } from '@/components/ui/field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  addProductImages, createBrand, createCategory, createProduct, deleteBrand, deleteCategory, deleteProduct,
  getBrands, getCategoriesPage, getProducts, removeProductImage, reorderProductImages, requestBrandLogoUploadUrl, requestCategoryLogoUploadUrl,
  requestProductImageUploadUrls, updateBrand, updateBrandLogo, updateCategory, updateCategoryLogo, updateProduct, uploadMediaFile,
} from '@/api/endpoints/catalog'
import type { CatalogBrand, CatalogCategory, CatalogProduct, MediaUpload, ProductPayload } from '@/api/endpoints/catalog'
import { getInventorySummary, type InventorySummary } from '@/api/endpoints/inventory'

type Section = 'products' | 'categories' | 'brands'
const pageSize = 20
const imageTypes = ['image/jpeg', 'image/png', 'image/webp']

function useDebounced(value: string) {
  const [result, setResult] = useState(value)
  useEffect(() => { const timer = window.setTimeout(() => setResult(value), 300); return () => window.clearTimeout(timer) }, [value])
  return result
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><span className="flex items-center gap-2"><AlertCircle className="size-4 text-destructive" />{message}</span><Button size="sm" variant="outline" onClick={retry}><AlertCircle />Retry</Button></div>
}

function StatRow({ stats }: { stats: Array<{ label: string; value: string; icon: typeof Package }> }) {
  return <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon }) => <Card key={label} size="sm" className="min-w-0"><CardHeader className="flex flex-row items-center justify-between gap-2"><CardTitle className="truncate text-xs font-medium text-muted-foreground">{label}</CardTitle><Icon className="size-4 shrink-0 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-semibold tracking-tight">{value}</div></CardContent></Card>)}</div>
}

function useCatalogStats() {
  const [stats, setStats] = useState<InventorySummary>()
  useEffect(() => { void getInventorySummary().then(setStats).catch(() => setStats(undefined)) }, [])
  return stats
}

type UploadState = { file: File; preview: string; status: 'queued' | 'uploading' | 'uploaded' | 'error'; message?: string }

function ImageDropzone({ multiple, initialImages = [], onChange, onRemoveExisting, onMoveExisting, statusByIndex = {} }: { multiple?: boolean; initialImages?: string[]; onChange: (files: File[]) => void; onRemoveExisting?: (key: string) => void; onMoveExisting?: (index: number, direction: 'left' | 'right') => void; statusByIndex?: Record<number, 'uploading' | 'uploaded' | 'error'> }) {
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<UploadState[]>([])
  const acceptFiles = (incoming: File[]) => {
    const valid = incoming.filter((file) => imageTypes.includes(file.type))
    const selected = multiple ? valid.slice(0, 10) : valid.slice(0, 1)
    setFiles(selected.map((file) => ({ file, preview: URL.createObjectURL(file), status: 'queued' })))
    onChange(selected)
  }
  return <Field>
    <FieldLabel>Images</FieldLabel>
    <div className="space-y-3">
      <button type="button" className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-sm transition-colors hover:border-primary hover:bg-muted/40" onClick={() => input.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); acceptFiles(Array.from(event.dataTransfer.files)) }}>
        <Upload className="size-5 text-muted-foreground" /><span className="font-medium">Drop {multiple ? 'images' : 'an image'} here or browse</span><span className="text-xs text-muted-foreground">JPEG, PNG or WebP{multiple ? ' · Up to 10 images' : ''}</span>
      </button>
      <input ref={input} hidden type="file" accept={imageTypes.join(',')} multiple={multiple} onChange={(event) => acceptFiles(Array.from(event.target.files ?? []))} />
      {(files.length > 0 || initialImages.length > 0) && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{initialImages.map((src, index) => <div key={src} className="relative aspect-square overflow-hidden rounded-lg border bg-muted"><img src={src} alt="" className="size-full object-cover" />{onRemoveExisting && <Button type="button" variant="destructive" size="icon-xs" className="absolute right-1 top-1" aria-label="Remove image" onClick={() => onRemoveExisting(src)}><X /></Button>}{onMoveExisting && <div className="absolute inset-x-1 bottom-1 flex justify-between"><Button type="button" variant="secondary" size="icon-xs" disabled={index === 0} aria-label="Move image left" onClick={() => onMoveExisting(index, 'left')}><ChevronLeft /></Button><Button type="button" variant="secondary" size="icon-xs" disabled={index === initialImages.length - 1} aria-label="Move image right" onClick={() => onMoveExisting(index, 'right')}><ChevronRight /></Button></div>}</div>)}{files.map((item, index) => { const status = statusByIndex[index] ?? item.status; return <div key={item.preview} className="relative aspect-square overflow-hidden rounded-lg border bg-muted"><img src={item.preview} alt="" className="size-full object-cover" />{status === 'uploading' && <div className="absolute inset-0 grid place-items-center bg-background/70"><Skeleton className="size-6 rounded-full" /></div>}{status === 'error' && <div className="absolute inset-x-0 bottom-0 bg-destructive/90 px-1 py-0.5 text-center text-[10px] text-destructive-foreground">Upload failed</div>}{status === 'uploaded' && <div className="absolute inset-x-0 bottom-0 bg-emerald-600/90 px-1 py-0.5 text-center text-[10px] text-white">Uploaded</div>}</div>})}</div>}
    </div>
  </Field>
}

async function uploadProductFiles(id: string, files: File[], setStatus: (index: number, status: 'uploading' | 'uploaded' | 'error') => void) {
  if (!files.length) return
  const uploads = await requestProductImageUploadUrls(id, files.map((file) => file.type))
  const completed: string[] = []
  for (let index = 0; index < files.length; index += 1) {
    setStatus(index, 'uploading')
    try { await uploadMediaFile(uploads.uploads[index], files[index]); setStatus(index, 'uploaded') } catch (cause) { setStatus(index, 'error'); throw cause }
    completed.push(uploads.uploads[index].key)
  }
  await addProductImages(id, completed)
}

function ProductDialog({ initial, categories, brands, open, onOpenChange, onSaved }: { initial?: CatalogProduct; categories: CatalogCategory[]; brands: CatalogBrand[]; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState<ProductPayload>({ name: '', sku: '', barcode: '', categoryId: '', brandId: null, description: '', rrp: 0, sellingPrice: 0, purchaseCost: 0, lowStockThreshold: 0 })
  const [files, setFiles] = useState<File[]>([]); const [existingImages, setExistingImages] = useState<string[]>(initial?.imageKeys ?? []); const [uploadStatus, setUploadStatus] = useState<Record<number, 'uploading' | 'uploaded' | 'error'>>({}); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  useEffect(() => { setForm({ name: initial?.name ?? '', sku: initial?.sku ?? '', barcode: initial?.barcode ?? '', categoryId: initial?.categoryId ?? '', brandId: initial?.brand?.id ?? null, description: initial?.description ?? '', rrp: initial?.rrp ?? 0, sellingPrice: initial?.sellingPrice ?? 0, purchaseCost: initial?.purchaseCost ?? 0, lowStockThreshold: initial?.lowStockThreshold ?? 0 }); setExistingImages(initial?.imageKeys ?? []); setFiles([]); setUploadStatus({}); setError('') }, [initial, open])
  const set = <K extends keyof ProductPayload>(key: K, value: ProductPayload[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async () => {
    if (!form.name.trim() || !form.sku.trim() || !form.categoryId) { setError('Product name, SKU, and category are required.'); return }
    setSaving(true); setError('')
    try {
      const saved = initial ? await updateProduct(initial.id, form) : await createProduct(form)
      await uploadProductFiles(saved.id, files, (index, status) => setUploadStatus((current) => ({ ...current, [index]: status })))
      onOpenChange(false); onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Product could not be saved.') } finally { setSaving(false) }
  }
  const removeExisting = async (key: string) => { if (!initial) return; try { const result = await removeProductImage(initial.id, key); setExistingImages(result.imageKeys) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Image could not be removed.') } }
  const moveExisting = async (index: number, direction: 'left' | 'right') => { if (!initial) return; const next = [...existingImages]; const target = direction === 'left' ? index - 1 : index + 1; [next[index], next[target]] = [next[target], next[index]]; try { await reorderProductImages(initial.id, next); setExistingImages(next) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Image order could not be saved.') } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto p-6 sm:max-w-3xl"><DialogHeader><DialogTitle>{initial ? 'Edit product' : 'Add product'}</DialogTitle><DialogDescription>Keep product information, pricing, inventory and media together.</DialogDescription></DialogHeader><FieldSet className="gap-6"><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Product name</FieldLabel><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Wireless Mouse" /></Field><Field><FieldLabel>SKU</FieldLabel><Input value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="SKU-001" /></Field><Field><FieldLabel>Barcode</FieldLabel><Input value={form.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} /></Field><Field><FieldLabel>Category</FieldLabel><Select value={form.categoryId} onValueChange={(value) => set('categoryId', value ?? '')}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field><Field><FieldLabel>Brand</FieldLabel><Select value={form.brandId ?? ''} onValueChange={(value) => set('brandId', value || null)}><SelectTrigger><SelectValue placeholder="No brand" /></SelectTrigger><SelectContent>{brands.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field></div><Field><FieldLabel>Description</FieldLabel><Textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Short product description" /></Field><Separator /><div><h3 className="mb-3 flex items-center gap-2 text-sm font-medium"><Package />Pricing and stock</h3><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>RRP</FieldLabel><Input type="number" min="0" value={form.rrp} onChange={(e) => set('rrp', Number(e.target.value))} /></Field><Field><FieldLabel>Selling price</FieldLabel><Input type="number" min="0" value={form.sellingPrice} onChange={(e) => set('sellingPrice', Number(e.target.value))} /></Field><Field><FieldLabel>Purchase cost</FieldLabel><Input type="number" min="0" value={form.purchaseCost} onChange={(e) => set('purchaseCost', Number(e.target.value))} /></Field><Field><FieldLabel>Low-stock threshold</FieldLabel><Input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', Number(e.target.value))} /><FieldDescription>Stock is managed through inventory.</FieldDescription></Field></div></div><Separator /><ImageDropzone multiple initialImages={existingImages} statusByIndex={uploadStatus} onRemoveExisting={removeExisting} onMoveExisting={moveExisting} onChange={setFiles} />{error && <FieldError>{error}</FieldError>}</FieldSet><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : initial ? 'Save product' : 'Create product'}</Button></DialogFooter></DialogContent></Dialog>
}

function EntityDialog({ kind, initial, open, onOpenChange, onSaved }: { kind: 'category' | 'brand'; initial?: CatalogCategory | CatalogBrand; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [file, setFile] = useState<File[]>([]); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  useEffect(() => { setName(initial?.name ?? ''); setDescription(initial?.description ?? ''); setFile([]); setError('') }, [initial, open])
  const submit = async () => {
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError('')
    try {
      const saved = kind === 'category' ? (initial ? await updateCategory(initial.id, { name, description }) : await createCategory({ name, description })) : (initial ? await updateBrand(initial.id, { name, description }) : await createBrand({ name, description }))
      if (file[0]) {
        const upload: MediaUpload = kind === 'category' ? await requestCategoryLogoUploadUrl(saved.id, file[0].type) : await requestBrandLogoUploadUrl(saved.id, file[0].type)
        await uploadMediaFile(upload, file[0])
        if (kind === 'category') await updateCategoryLogo(saved.id, upload.key); else await updateBrandLogo(saved.id, upload.key)
      }
      onOpenChange(false); onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Could not save ${kind}.`) } finally { setSaving(false) }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-xl"><DialogHeader><DialogTitle>{initial ? `Edit ${kind}` : `Add ${kind}`}</DialogTitle><DialogDescription>Create a reusable {kind} for your catalog.</DialogDescription></DialogHeader><FieldSet className="gap-5"><Field><FieldLabel>{kind === 'category' ? 'Category name' : 'Brand name'}</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field><FieldLabel>Description</FieldLabel><Textarea value={description ?? ''} onChange={(e) => setDescription(e.target.value)} /></Field><ImageDropzone onChange={setFile} />{error && <FieldError>{error}</FieldError>}</FieldSet><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></DialogFooter></DialogContent></Dialog>
}

function ConfirmDelete({ target, onOpenChange, onConfirm }: { target?: { type: string; name: string }; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  return <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {target?.type}?</AlertDialogTitle><AlertDialogDescription>This will delete “{target?.name}”. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onConfirm}><Trash2 />Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Open actions"><MoreHorizontal /></Button>} /><DropdownMenuContent align="end" className="w-36"><DropdownMenuItem onClick={onEdit}><Pencil />Edit</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
}

function ProductsSection() {
  const [items, setItems] = useState<CatalogProduct[]>([]); const [categories, setCategories] = useState<CatalogCategory[]>([]); const [brands, setBrands] = useState<CatalogBrand[]>([]); const [search, setSearch] = useState(''); const query = useDebounced(search); const [categoryId, setCategoryId] = useState(''); const [brandId, setBrandId] = useState(''); const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1); const [totalProducts, setTotalProducts] = useState(0); const [sortBy, setSortBy] = useState<'name' | 'sellingPrice' | 'stockQuantity' | 'createdAt'>('createdAt'); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [dialog, setDialog] = useState<{ open: boolean; item?: CatalogProduct }>({ open: false }); const [remove, setRemove] = useState<CatalogProduct>()
  const load = () => { setLoading(true); setError(''); Promise.all([getProducts({ page, limit: pageSize, search: query, categoryId: categoryId || undefined, brandId: brandId || undefined, sortBy, sortOrder: 'desc' }), getCategoriesPage({ page: 1, limit: 100 }), getBrands({ page: 1, limit: 100 })]).then(([products, categoryResult, brandResult]) => { setItems(products.items); setTotalPages(products.pagination.totalPages); setTotalProducts(products.pagination.total); setCategories(categoryResult.items); setBrands(brandResult.items) }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Products could not be loaded.')).finally(() => setLoading(false)) }
  useEffect(() => { setPage(1) }, [query, categoryId, brandId]); useEffect(load, [page, query, categoryId, brandId, sortBy])
  const deleteItem = async () => { if (!remove) return; try { await deleteProduct(remove.id); setRemove(undefined); load() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Product could not be deleted.') } }
  return <><div className="mb-5 flex flex-wrap items-center gap-2"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" /><Input className="h-9 pl-8" placeholder="Search products by name, SKU, barcode..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? '')}><SelectTrigger className="h-9 w-36"><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="">All categories</SelectItem>{categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={brandId} onValueChange={(value) => setBrandId(value ?? '')}><SelectTrigger className="h-9 w-32"><SelectValue placeholder="All brands" /></SelectTrigger><SelectContent><SelectItem value="">All brands</SelectItem>{brands.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="sm"><Layers3 />Sort</Button>} /><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setSortBy('createdAt')}>Newest</DropdownMenuItem><DropdownMenuItem onClick={() => setSortBy('name')}>Name</DropdownMenuItem><DropdownMenuItem onClick={() => setSortBy('sellingPrice')}>Price</DropdownMenuItem><DropdownMenuItem onClick={() => setSortBy('stockQuantity')}>Stock</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button size="sm" onClick={() => setDialog({ open: true })}><Plus />Add product</Button></div>{error ? <ErrorState message={error} retry={load} /> : <Card className="w-full overflow-hidden"><div className="w-full overflow-x-auto"><Table className="min-w-[1120px] text-xs"><TableHeader><TableRow><TableHead className="w-[260px]">Product</TableHead><TableHead>SKU</TableHead><TableHead>Brand</TableHead><TableHead>Category</TableHead><TableHead>Purchase</TableHead><TableHead>Selling</TableHead><TableHead>Stock</TableHead><TableHead>Status</TableHead><TableHead>Supplier</TableHead><TableHead className="w-12 text-right" /></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 8 }, (_, row) => <TableRow key={row}>{Array.from({ length: 10 }, (_, cell) => <TableCell className="py-2" key={cell}><Skeleton className="h-3 w-full" /></TableCell>)}</TableRow>) : items.map((item) => <TableRow key={item.id}><TableCell className="py-2"><div className="flex items-center gap-2"><div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">{item.imageKeys[0] ? <img src={item.imageKeys[0]} alt="" className="size-full object-contain" /> : <ImageIcon className="size-4 text-muted-foreground" />}</div><span className="font-medium">{item.name}</span></div></TableCell><TableCell>{item.sku}</TableCell><TableCell>{item.brand?.name ?? '—'}</TableCell><TableCell>{item.category?.name ?? categories.find((category) => category.id === item.categoryId)?.name ?? '—'}</TableCell><TableCell>${(item.purchaseCost ?? 0).toFixed(2)}</TableCell><TableCell>${item.sellingPrice.toFixed(2)}</TableCell><TableCell>{item.stockQuantity}</TableCell><TableCell><Badge variant={item.stockQuantity <= 0 ? 'destructive' : item.stockQuantity <= item.lowStockThreshold ? 'secondary' : 'outline'}>{item.stockQuantity <= 0 ? 'Out' : item.stockQuantity <= item.lowStockThreshold ? 'Low' : 'In stock'}</Badge></TableCell><TableCell>{item.supplier?.name ?? '—'}</TableCell><TableCell><Actions onEdit={() => setDialog({ open: true, item })} onDelete={() => setRemove(item)} /></TableCell></TableRow>)}</TableBody></Table></div><div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">Showing {items.length} of {totalProducts} products<span className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></span></div></Card>}<ProductDialog initial={dialog.item} categories={categories} brands={brands} open={dialog.open} onOpenChange={(open) => setDialog((current) => ({ ...current, open }))} onSaved={load} /><ConfirmDelete target={remove ? { type: 'product', name: remove.name } : undefined} onOpenChange={(open) => !open && setRemove(undefined)} onConfirm={deleteItem} /></>
}

function EntitySection({ kind }: { kind: 'category' | 'brand' }) {
  const [items, setItems] = useState<(CatalogCategory | CatalogBrand)[]>([]); const [search, setSearch] = useState(''); const query = useDebounced(search); const [totalCount, setTotalCount] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [dialog, setDialog] = useState<{ open: boolean; item?: CatalogCategory | CatalogBrand }>({ open: false }); const [remove, setRemove] = useState<CatalogCategory | CatalogBrand>(); const [selectedBrand, setSelectedBrand] = useState<CatalogBrand>(); const [expanded, setExpanded] = useState<Set<string>>(new Set()); const summary = useCatalogStats()
  const load = () => { setLoading(true); setError(''); const request = kind === 'category' ? getCategoriesPage({ page: 1, limit: 100, search: query, includeChildren: true }) : getBrands({ page: 1, limit: 100, search: query }); request.then((result) => { setItems(result.items); setTotalCount(result.pagination.total) }).catch((cause) => setError(cause instanceof Error ? cause.message : `Could not load ${kind}s.`)).finally(() => setLoading(false)) }
  useEffect(load, [kind, query])
  const removeItem = async () => { if (!remove) return; try { if (kind === 'category') await deleteCategory(remove.id); else await deleteBrand(remove.id); setRemove(undefined); load() } catch (cause) { setError(cause instanceof Error ? cause.message : `Could not delete ${kind}.`) } }
  const rows = useMemo(() => kind === 'category' ? (items as CatalogCategory[]).flatMap((item) => expanded.has(item.id) ? [item, ...(item.children ?? []).map((child) => ({ ...child, name: `↳ ${child.name}` }))] : [item]) : items, [items, expanded, kind])
  const label = kind === 'category' ? 'category' : 'brand'
  return <><StatRow stats={[{ label: kind === 'category' ? 'Total categories' : 'Total brands', value: String(totalCount), icon: kind === 'category' ? Tags : Layers3 }, { label: 'Total products', value: String(summary?.totalProducts ?? '—'), icon: Package }, { label: 'Low stock products', value: String(summary?.lowStockProducts ?? '—'), icon: AlertCircle }, { label: 'Inventory value', value: summary ? `$${summary.inventoryValue.toFixed(2)}` : '—', icon: Package }]} /><div className="mb-5 flex flex-wrap items-center gap-2"><div className="relative min-w-[220px] max-w-md flex-1"><Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" /><Input className="h-9 pl-8" placeholder={`Search ${label}${kind === 'category' ? 'ies' : 's'}`} value={search} onChange={(e) => setSearch(e.target.value)} /></div><Button size="sm" onClick={() => setDialog({ open: true })}><Plus />Add {kind}</Button></div>{error ? <ErrorState message={error} retry={load} /> : <Card className="w-full overflow-hidden"><div className="w-full overflow-x-auto"><Table className="min-w-[700px] text-xs"><TableHeader><TableRow><TableHead>{kind === 'category' ? 'Name' : 'Brand'}</TableHead><TableHead>{kind === 'brand' ? 'Products' : 'Description'}</TableHead><TableHead>Status</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 6 }, (_, row) => <TableRow key={row}>{Array.from({ length: 4 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-3 w-full" /></TableCell>)}</TableRow>) : rows.map((item) => { const category = item as CatalogCategory; const brand = item as CatalogBrand; const hasChildren = kind === 'category' && Boolean(category.children?.length); return <TableRow key={item.id}><TableCell><div className="flex items-center gap-1">{hasChildren && <Button variant="ghost" size="icon-xs" aria-label={expanded.has(item.id) ? 'Collapse category' : 'Expand category'} onClick={() => setExpanded((current) => { const next = new Set(current); expanded.has(item.id) ? next.delete(item.id) : next.add(item.id); return next })}>{expanded.has(item.id) ? <ChevronDown /> : <ChevronRight />}</Button>}{kind === 'brand' && <div className="grid size-7 place-items-center rounded-full bg-muted text-xs">{item.name.slice(0, 1).toUpperCase()}</div>}<Button variant={kind === 'brand' ? 'link' : 'ghost'} size="sm" className="h-auto justify-start p-0 font-medium" onClick={() => kind === 'brand' && setSelectedBrand(brand)}>{item.name}</Button></div></TableCell><TableCell>{kind === 'brand' ? (brand.productCount ?? '—') : (item.description || '—')}</TableCell><TableCell><Badge variant={item.isActive === false ? 'secondary' : 'outline'}>{item.isActive === false ? 'Inactive' : 'Active'}</Badge></TableCell><TableCell><Actions onEdit={() => setDialog({ open: true, item })} onDelete={() => setRemove(item)} /></TableCell></TableRow> })}</TableBody></Table></div></Card>}<EntityDialog kind={kind} initial={dialog.item} open={dialog.open} onOpenChange={(open) => setDialog((current) => ({ ...current, open }))} onSaved={load} /><ConfirmDelete target={remove ? { type: kind, name: remove.name } : undefined} onOpenChange={(open) => !open && setRemove(undefined)} onConfirm={removeItem} /><Sheet open={Boolean(selectedBrand)} onOpenChange={(open) => !open && setSelectedBrand(undefined)}><SheetContent><SheetHeader><SheetTitle>{selectedBrand?.name}</SheetTitle><SheetDescription>{selectedBrand?.description || 'Brand details'}</SheetDescription></SheetHeader><div className="grid grid-cols-2 gap-3 p-4"><Card size="sm"><CardHeader><CardTitle>Products</CardTitle></CardHeader><CardContent><strong>{selectedBrand?.productCount ?? '—'}</strong></CardContent></Card><Card size="sm"><CardHeader><CardTitle>Status</CardTitle></CardHeader><CardContent><Badge variant={selectedBrand?.isActive === false ? 'secondary' : 'outline'}>{selectedBrand?.isActive === false ? 'Inactive' : 'Active'}</Badge></CardContent></Card></div></SheetContent></Sheet></>
}

export function CatalogPage() {
  const location = useLocation(); const section: Section = location.pathname.endsWith('/categories') ? 'categories' : location.pathname.endsWith('/brands') ? 'brands' : 'products'
  const title = section === 'products' ? 'Products' : section === 'categories' ? 'Categories' : 'Brands'
  const description = section === 'products' ? 'Manage your products, pricing, stock and catalog information.' : section === 'categories' ? 'Organize your products into categories and subcategories.' : 'Manage product brands and review their catalog presence.'
  return <PageContainer><PageHeader title={title} description={description} />{section === 'products' ? <ProductsSection /> : <EntitySection kind={section === 'categories' ? 'category' : 'brand'} />}</PageContainer>
}
