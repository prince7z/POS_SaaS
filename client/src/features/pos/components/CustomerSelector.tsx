import { useCallback, useEffect, useRef, useState } from 'react'
import { SearchableSelect } from '@/components/common/SearchableSelect'
import { getCustomers } from '@/api/endpoints/customers'
import { showError } from '@/components/feedback/notifications'
import type { Customer } from '../types'

const WALK_IN_VALUE = '__walk-in__'

export function CustomerSelector({
  customers,
  selectedCustomerId,
  onSelectCustomer,
}: {
  customers: Customer[]
  selectedCustomerId: string | null
  onSelectCustomer: (customerId: string | null) => void
}) {
  const [searchResults, setSearchResults] = useState<Customer[] | null>(null)
  const [cachedSelected, setCachedSelected] = useState<Customer | null>(null)
  const searchTimer = useRef<number | undefined>(undefined)
  const searchSequence = useRef(0)
  const visibleCustomers = searchResults ?? customers
  const selected =
    customers.find((customer) => customer.id === selectedCustomerId) ??
    searchResults?.find((customer) => customer.id === selectedCustomerId) ??
    (cachedSelected?.id === selectedCustomerId ? cachedSelected : undefined)
  const handleSearch = useCallback((value: string) => {
    if (searchTimer.current !== undefined) window.clearTimeout(searchTimer.current)
    const sequence = ++searchSequence.current
    const search = value.trim()
    if (!search) {
      setSearchResults(null)
      return
    }
    searchTimer.current = window.setTimeout(() => {
      getCustomers({
        page: 1,
        limit: 100,
        search,
        includeInactive: false,
        sortBy: 'name',
        sortOrder: 'asc',
      })
        .then((result) => {
          if (searchSequence.current === sequence) setSearchResults(result.items)
        })
        .catch((error) => {
          if (searchSequence.current === sequence) showError('Customer search failed', error)
        })
    }, 250)
  }, [])

  useEffect(
    () => () => {
      if (searchTimer.current !== undefined) window.clearTimeout(searchTimer.current)
    },
    [],
  )

  const options = [
    { value: WALK_IN_VALUE, label: 'Walk-in Customer' },
    ...(selected && !selected.isWalkIn && !visibleCustomers.some((customer) => customer.id === selected.id)
      ? [
          {
            value: selected.id,
            label: [selected.name, selected.phone, selected.email].filter(Boolean).join(' · '),
          },
        ]
      : []),
    ...visibleCustomers
      .filter((customer) => !customer.isWalkIn)
      .map((customer) => ({
        value: customer.id,
        label: [customer.name, customer.phone, customer.email].filter(Boolean).join(' · '),
      })),
  ]

  return (
    <SearchableSelect
      options={options}
      value={selected?.isWalkIn ? WALK_IN_VALUE : (selectedCustomerId ?? WALK_IN_VALUE)}
      onChange={(value) => {
        const customer = visibleCustomers.find((option) => option.id === value)
        if (customer) setCachedSelected(customer)
        onSelectCustomer(value === WALK_IN_VALUE ? null : value || null)
      }}
      placeholder="Walk-in Customer"
      emptyMessage="No matching customers."
      onSearch={handleSearch}
    />
  )
}
