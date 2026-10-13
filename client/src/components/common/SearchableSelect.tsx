import { Combobox } from '@base-ui/react/combobox'
import { Input } from '@chakra-ui/react'

export interface SearchableSelectOption {
  value: string
  label: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  emptyMessage = 'No matching options.',
  width = 'full',
}: {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
  emptyMessage?: string
  width?: string
}) {
  const selectedOption = options.find((option) => option.value === value) ?? null

  return (
    <Combobox.Root
      items={options}
      value={selectedOption}
      onValueChange={(option) => onChange(option?.value ?? '')}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(option, selected) => option.value === selected.value}
      autoHighlight
    >
      <Combobox.Input
        render={<Input size="sm" w={width} disabled={disabled} />}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <Combobox.Portal>
        <Combobox.Positioner className="z-50">
          <Combobox.Popup className="max-h-72 min-w-[var(--anchor-width)] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
            <Combobox.List className="max-h-64 overflow-y-auto">
              {options.map((option) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  {option.label}
                </Combobox.Item>
              ))}
              <Combobox.Empty className="px-2 py-2 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </Combobox.Empty>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
