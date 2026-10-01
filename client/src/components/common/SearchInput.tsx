import { Input, InputGroup } from '@chakra-ui/react'
import { Search } from 'lucide-react'

export function SearchInput({ placeholder = 'Search...', value, onChange }: { placeholder?: string; value?: string; onChange?: (value: string) => void }) {
  return (
    <InputGroup startElement={<Search size={15} />}>
      <Input size="sm" value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} bg="background" borderColor="border" />
    </InputGroup>
  )
}
