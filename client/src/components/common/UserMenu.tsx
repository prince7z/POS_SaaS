import { useState } from 'react'
import { Avatar, Button, Menu, Spinner, Text, VStack } from '@chakra-ui/react'
import { Check, ChevronDown, LogOut, Settings, Store, User } from 'lucide-react'
import { clearAuthSession, getStoredCompany, getStoredCompanies, getStoredUser, setAuthSession } from '@/lib/auth'
import { switchCompany } from '@/api/endpoints/auth'
import { showError, stashToast } from '@/components/feedback/notifications'
import { useNavigate } from 'react-router-dom'

export function UserMenu({ collapsed = false, compact = false }: { collapsed?: boolean; compact?: boolean }) {
  const user = getStoredUser()
  const currentCompany = getStoredCompany()
  const companies = getStoredCompanies()
  const navigate = useNavigate()
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const handleLogout = () => {
    clearAuthSession()
    navigate('/auth/login')
  }

  const handleSwitchCompany = async (targetCompanyId: string) => {
    if (targetCompanyId === currentCompany?.id || switchingId) return
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

  const displayName = user?.fullName || 'John Doe'
  const Logo = currentCompany?.logoUrl 
  const displayRole = user?.roleName || 'Store Manager'

  return (
    <Menu.Root positioning={{ placement: 'bottom-end' }}>
      <Menu.Trigger asChild>
        <Button variant="ghost" w={collapsed ? 'full' : 'auto'} justifyContent="flex-start" px="2">
          <Avatar.Root size="sm">
            {Logo ? (
              <Avatar.Image src={Logo} alt={displayName} />
            ) : (
              <Avatar.Fallback name={displayName} />
            )}
          </Avatar.Root>
          {!collapsed && !compact && (
            <VStack align="start" gap="0" ml="2">
              <Text fontSize="sm">{displayName}</Text>
              <Text fontSize="xs" color="secondary">
                {displayRole}
              </Text>
            </VStack>
          )}
          {!collapsed && !compact && <ChevronDown size={15} />}
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="220px">
          {companies.length > 0 && (
            <>
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel fontSize="xs" fontWeight="600" color="secondary" px="2" py="1">
                  Switch Store / Company
                </Menu.ItemGroupLabel>
                {companies.map((comp) => {
                  const isActive = comp.id === currentCompany?.id
                  const isSwitching = comp.id === switchingId
                  return (
                    <Menu.Item
                      key={comp.id}
                      value={comp.id}
                      onClick={() => handleSwitchCompany(comp.id)}
                      cursor="pointer"
                      py="2"
                    >
                      <Avatar.Root size="xs">
                        {comp.logoUrl ? (
                          <Avatar.Image src={comp.logoUrl} alt={comp.name} />
                        ) : (
                          <Avatar.Fallback name={comp.name} />
                        )}
                      </Avatar.Root>
                      <VStack align="start" gap="0" flex="1" ml="2">
                        <Text fontSize="sm" fontWeight={isActive ? '600' : 'normal'}>
                          {comp.name}
                        </Text>
                        <Text fontSize="xs" color="secondary">
                          {comp.roleName || 'Store'}
                        </Text>
                      </VStack>
                      {isActive ? (
                        <Check size={14} color="#16a34a" />
                      ) : isSwitching ? (
                        <Spinner size="xs" />
                      ) : (
                        <Store size={14} opacity={0.4} />
                      )}
                    </Menu.Item>
                  )
                })}
              </Menu.ItemGroup>
              <Menu.Separator />
            </>
          )}
          <Menu.Item value="profile">
            <User size={15} />
            Profile
          </Menu.Item>
          <Menu.Item value="settings" onClick={() => navigate('/settings')}>
            <Settings size={15} />
            Settings
          </Menu.Item>
          <Menu.Item value="logout" color="danger" onClick={handleLogout}>
            <LogOut size={15} />
            Log out
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  )
}
