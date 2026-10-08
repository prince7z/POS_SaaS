import { useState } from 'react'
import { Box, Button, HStack, Menu, Spinner, Text } from '@chakra-ui/react'
import { Check, ChevronDown, Store } from 'lucide-react'
import { getStoredCompany, getStoredCompanies, setAuthSession } from '@/lib/auth'
import { switchCompany } from '@/api/endpoints/auth'
import { showError, stashToast } from '@/components/feedback/notifications'

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  const company = getStoredCompany()
  const companies = getStoredCompanies()
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const handleSwitchCompany = async (targetCompanyId: string) => {
    if (targetCompanyId === company?.id || switchingId) return
    const targetComp = companies.find((c) => c.id === targetCompanyId)
    try {
      setSwitchingId(targetCompanyId)
      const res = await switchCompany(targetCompanyId)
      setAuthSession(res)
      stashToast('success', 'Store switched', `Now managing ${res.company.name || targetComp?.name || 'store'}`)
      window.location.reload()
    } catch (err) {
      console.error('Failed to switch company', err)
      showError('Failed to switch store', err)
      setSwitchingId(null)
    }
  }

  const name = company?.name || 'POS SaaS'
  const logoUrl = company?.logoUrl

  const content = (
    <HStack gap="2" cursor={companies.length > 1 ? 'pointer' : 'default'}>
      {logoUrl ? (
        <Box boxSize="32px" p="0.5" borderRadius="md" overflow="hidden" flexShrink={0} bg="white" border="1px solid" borderColor="border">
          <img src={logoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </Box>
      ) : (
        <Box bg="primary" color="white" p="2" borderRadius="md" flexShrink={0}>
          <Store size={16} />
        </Box>
      )}
      {!collapsed && (
        <Box minW="0" overflow="hidden" textAlign="left">
          <HStack gap="1">
            <Text fontWeight="700" lineHeight="1.2" truncate maxW="120px">
              {name}
            </Text>
            {companies.length > 1 && <ChevronDown size={13} color="var(--chakra-colors-secondary)" />}
          </HStack>
          <Text fontSize="xs" color="secondary" mt="0.5" truncate>
            {company?.currencyCode ? `${company.currencyCode} Store` : 'Point of Sale Suite'}
          </Text>
        </Box>
      )}
    </HStack>
  )

  if (companies.length <= 1) {
    return content
  }

  return (
    <Menu.Root positioning={{ placement: 'bottom-start' }}>
      <Menu.Trigger asChild>
        <Button variant="ghost" p="1" h="auto" minW="auto">
          {content}
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="220px">
          <Menu.ItemGroup>
            <Menu.ItemGroupLabel fontSize="xs" fontWeight="600" color="secondary" px="2" py="1">
              Switch Store / Company
            </Menu.ItemGroupLabel>
            {companies.map((comp) => {
              const isActive = comp.id === company?.id
              const isSwitching = comp.id === switchingId
              return (
                <Menu.Item
                  key={comp.id}
                  value={`company-${comp.id}`}
                  onClick={() => handleSwitchCompany(comp.id)}
                  cursor={isActive ? 'default' : 'pointer'}
                  fontWeight={isActive ? '600' : '400'}
                >
                  {comp.logoUrl ? (
                    <img
                      src={comp.logoUrl}
                      alt={comp.name}
                      style={{
                        width: '18px',
                        height: '18px',
                        objectFit: 'contain',
                        borderRadius: '3px',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <Store size={15} />
                  )}
                  <Text fontSize="sm" flex="1" truncate>
                    {comp.name}
                  </Text>
                  {isSwitching ? (
                    <Spinner size="xs" />
                  ) : isActive ? (
                    <Check size={14} className="text-blue-600" />
                  ) : null}
                </Menu.Item>
              )
            })}
          </Menu.ItemGroup>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  )
}
