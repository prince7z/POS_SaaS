import { createContext, useContext, useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { Badge as ChakraBadge, Box, Button as ChakraButton, Card as ChakraCard, Drawer, Field as ChakraField, Heading, Input as ChakraInput, NativeSelect, Separator as ChakraSeparator, Skeleton as ChakraSkeleton, Table as ChakraTable, Text, Textarea as ChakraTextarea } from '@chakra-ui/react'

export const Button = ({ variant = 'solid', size = 'md', ...props }: any) => <ChakraButton variant={variant === 'default' ? 'solid' : variant === 'destructive' ? 'solid' : variant} colorPalette={variant === 'destructive' ? 'red' : undefined} size={size === 'icon-sm' || size === 'icon-xs' ? 'xs' : size} {...props} />
export const Input = (props: ComponentProps<typeof ChakraInput>) => <ChakraInput size="sm" {...props} />
export const Textarea = (props: ComponentProps<typeof ChakraTextarea>) => <ChakraTextarea size="sm" {...props} />
export const Badge = (props: any) => <ChakraBadge variant={props.variant === 'outline' ? 'outline' : 'subtle'} {...props} />
export const Skeleton = (props: any) => <ChakraSkeleton {...props} />
export const Separator = () => <ChakraSeparator />

export const Card = Object.assign(
  (props: any) => <ChakraCard.Root variant="outline" {...props} />,
  {
    Header: (props: any) => <ChakraCard.Header {...props} />,
    Content: (props: any) => <ChakraCard.Body {...props} />,
    Title: (props: any) => <ChakraCard.Title {...props} />,
  },
)

export const Table = Object.assign(
  (props: any) => <ChakraTable.Root {...props} />,
  {
    Body: (props: any) => <ChakraTable.Body {...props} />,
    Cell: (props: any) => <ChakraTable.Cell {...props} />,
    Head: (props: any) => <ChakraTable.ColumnHeader {...props} />,
    Header: (props: any) => <ChakraTable.Header {...props} />,
    Row: (props: any) => <ChakraTable.Row {...props} />,
  },
)

export const Field = ({ children }: { children: ReactNode }) => <ChakraField.Root>{children}</ChakraField.Root>
export const FieldLabel = (props: any) => <ChakraField.Label {...props} />
export const FieldDescription = (props: any) => <ChakraField.HelperText {...props} />
export const FieldError = (props: any) => <ChakraField.ErrorText {...props} />
export const FieldSet = ({ children, ...props }: any) => <Box display="flex" flexDirection="column" {...props}>{children}</Box>

const SelectContext = createContext<{ value: string; setValue: (value: string) => void; options: Array<{ value: string; label: ReactNode }>; setOptions: (value: any) => void }>({ value: '', setValue: () => undefined, options: [], setOptions: () => undefined })
function SelectRoot({ value = '', onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: ReactNode }) {
  const [current, setCurrent] = useState(value)
  const [options, setOptions] = useState<Array<{ value: string; label: ReactNode }>>([])
  const setValue = (next: string) => { setCurrent(next); onValueChange?.(next) }
  return <SelectContext.Provider value={{ value: current, setValue, options, setOptions }}><Box>{children}</Box></SelectContext.Provider>
}
const SelectOption = ({ value, children }: { value: string; children: ReactNode }) => {
  const context = useContext(SelectContext)
  useEffect(() => { context.setOptions((current: Array<{ value: string; label: ReactNode }>) => current.some((item) => item.value === value) ? current : [...current, { value, label: children }]) }, [value, children])
  return null
}
export const Select = Object.assign(SelectRoot, {
  Trigger: ({ children }: any) => <Box>{children}</Box>,
  Value: (props: any) => <Box {...props} />,
  Content: ({ children }: any) => <Box display="none">{children}</Box>,
  Item: SelectOption,
})
export const SelectValue = (props: any) => <Box {...props} />
export const SelectTrigger = ({ children }: any) => {
  const context = useContext(SelectContext)
  void children
  return <NativeSelect.Root size="sm" minW="150px"><NativeSelect.Field value={context.value} onChange={(event) => context.setValue(event.target.value)}>{context.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</NativeSelect.Field></NativeSelect.Root>
}
export const SelectContent = ({ children }: { children: ReactNode }) => <>{children}</>
export const SelectItem = SelectOption

export const Dialog = ({ open, onOpenChange, children }: any) => open ? <Box position="fixed" inset="0" zIndex="modal" bg="blackAlpha.600" p="4" onClick={() => onOpenChange(false)}>{children}</Box> : null
export const DialogContent = ({ children }: any) => <Box maxH="92vh" overflowY="auto" maxW="760px" mx="auto" mt="4" bg="bg" borderRadius="lg" p="6" onClick={(event) => event.stopPropagation()}>{children}</Box>
export const DialogHeader = (props: any) => <Box mb="5" {...props} />
export const DialogTitle = (props: any) => <Heading size="md" {...props} />
export const DialogDescription = (props: any) => <Text color="secondary" fontSize="sm" {...props} />
export const DialogFooter = (props: any) => <Box display="flex" justifyContent="flex-end" gap="3" mt="5" {...props} />

export const AlertDialog = Dialog
export const AlertDialogContent = DialogContent
export const AlertDialogHeader = DialogHeader
export const AlertDialogTitle = DialogTitle
export const AlertDialogDescription = DialogDescription
export const AlertDialogFooter = DialogFooter
export const AlertDialogCancel = (props: any) => <Button variant="outline" {...props} />
export const AlertDialogAction = (props: any) => <Button {...props} />

export const DropdownMenu = ({ children }: any) => <>{children}</>
export const DropdownMenuTrigger = ({ children, render }: { children?: ReactNode; render?: ReactNode }) => render ?? children
export const DropdownMenuContent = ({ children }: any) => <Box position="absolute" zIndex="dropdown" bg="bg" borderWidth="1px" borderRadius="md" p="1">{children}</Box>
export const DropdownMenuItem = (props: any) => <Button variant="ghost" size="sm" w="full" justifyContent="flex-start" {...props} />
export const DropdownMenuSeparator = () => <Separator />

export const Sheet = ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) => open ? <Drawer.Root open onOpenChange={(event) => onOpenChange(!event.open)}>{children}</Drawer.Root> : null
export const SheetContent = ({ children }: any) => <><Drawer.Backdrop /><Drawer.Positioner><Drawer.Content><Drawer.Body>{children}</Drawer.Body></Drawer.Content></Drawer.Positioner></>
export const SheetHeader = (props: any) => <Box mb="5" {...props} />
export const SheetTitle = (props: any) => <Heading size="md" {...props} />
export const SheetDescription = (props: any) => <Text color="secondary" fontSize="sm" {...props} />

export const CardContent = Card.Content
export const CardHeader = Card.Header
export const CardTitle = Card.Title
export const TableBody = Table.Body
export const TableCell = Table.Cell
export const TableHead = Table.Head
export const TableHeader = Table.Header
export const TableRow = Table.Row
