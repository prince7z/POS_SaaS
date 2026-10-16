import { useEffect } from 'react'
import { Combobox, Portal, useListCollection } from '@chakra-ui/react'
import { Check, ChevronDown, X } from 'lucide-react'

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
  onSearch,
}: {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
  emptyMessage?: string
  width?: string
  onSearch?: (value: string) => void
}) {
  const optionsSignature = JSON.stringify(options)
  const { collection, filter, set } = useListCollection({
    initialItems: options,
    itemToString: (option) => option.label,
    itemToValue: (option) => option.value,
    filter: (itemText, filterText) =>
      itemText.toLocaleLowerCase().includes(filterText.toLocaleLowerCase()),
  })

  useEffect(() => {
    set(options)
  }, [optionsSignature, set])

  return (
    <Combobox.Root
      collection={collection}
      value={value ? [value] : []}
      onValueChange={(details) => onChange(details.value[0] ?? '')}
      onOpenChange={(details) => {
        if (details.open) {
          filter('')
          onSearch?.('')
        }
      }}
      onInputValueChange={(details) => {
        filter(details.inputValue)
        onSearch?.(details.inputValue)
      }}
      openOnClick
      disabled={disabled}
      size="sm"
      width={width}
    >
      <Combobox.Control>
        <Combobox.Input placeholder={placeholder} aria-label={placeholder} />
        <Combobox.IndicatorGroup>
          <Combobox.ClearTrigger aria-label="Clear selection">
            <X size={14} />
          </Combobox.ClearTrigger>
          <Combobox.Trigger aria-label="Show options">
            <ChevronDown size={16} />
          </Combobox.Trigger>
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border"
            borderRadius="md"
            boxShadow="lg"
            maxH="72"
            overflowY="auto"
            zIndex="popover"
            width="var(--reference-width)"
          >
            <Combobox.Empty px="3" py="2" textAlign="center" color="fg.muted" fontSize="sm">
              {emptyMessage}
            </Combobox.Empty>
            {collection.items.map((option) => (
              <Combobox.Item
                key={option.value}
                item={option}
                px="3"
                py="2"
                cursor="pointer"
                _highlighted={{ bg: 'bg.subtle' }}
              >
                <Combobox.ItemText>{option.label}</Combobox.ItemText>
                <Combobox.ItemIndicator>
                  <Check size={14} />
                </Combobox.ItemIndicator>
              </Combobox.Item>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  )
}
