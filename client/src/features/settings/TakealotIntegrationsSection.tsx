import { useCallback, useEffect, useState } from 'react'
import { Badge, Box, Button, Card, Field, Grid, Heading, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { Check, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import {
  createTakealotIntegration,
  deleteIntegration,
  getIntegrations,
  testTakealotIntegration,
  updateTakealotIntegration,
  type Integration,
} from '@/api/endpoints/integrations'
import { showError, showSuccess } from '@/components/feedback/notifications'

const dispatchIntegrationsChanged = () => window.dispatchEvent(new CustomEvent('pos-integrations-updated'))

export function TakealotIntegrationsSection() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState('')
  const [editingId, setEditingId] = useState('')
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [sellerId, setSellerId] = useState('')
  const [threshold, setThreshold] = useState('5')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setIntegrations((await getIntegrations()).filter((integration) => integration.type === 'TAKEALOT'))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Takealot integrations could not be loaded.'
      setError(message)
      showError('Unable to load integrations', cause)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const resetForm = () => {
    setEditingId('')
    setName('')
    setApiKey('')
    setSellerId('')
    setThreshold('5')
  }

  const save = async () => {
    const parsedThreshold = Number(threshold)
    if (!name.trim()) {
      setError('Enter a name for this Takealot connection.')
      return
    }
    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1 || parsedThreshold > 100_000) {
      setError('Low-stock threshold must be a whole number between 1 and 100,000.')
      return
    }
    if (!editingId && !apiKey.trim()) {
      setError('Enter the Takealot API key to create a connection.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await updateTakealotIntegration(editingId, {
          name: name.trim(),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          sellerId: sellerId.trim() || null,
          lowStockThreshold: parsedThreshold,
        })
        showSuccess('Takealot connection updated')
      } else {
        await createTakealotIntegration({
          type: 'TAKEALOT',
          name: name.trim(),
          apiKey: apiKey.trim(),
          ...(sellerId.trim() ? { sellerId: sellerId.trim() } : {}),
          lowStockThreshold: parsedThreshold,
        })
        showSuccess('Takealot connection added')
      }
      resetForm()
      await reload()
      dispatchIntegrationsChanged()
    } catch (cause) {
      showError('Unable to save Takealot connection', cause)
      setError(cause instanceof Error ? cause.message : 'Takealot connection could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const test = async (integration: Integration) => {
    setTestingId(integration.id)
    try {
      const result = await testTakealotIntegration(integration.id)
      if (!result.connected) throw new Error('Takealot did not confirm the connection.')
      showSuccess('Takealot connection verified', integration.name)
    } catch (cause) {
      showError(`Could not verify ${integration.name}`, cause)
    } finally {
      setTestingId('')
    }
  }

  const toggleActive = async (integration: Integration) => {
    try {
      await updateTakealotIntegration(integration.id, { isActive: !integration.isActive })
      await reload()
      dispatchIntegrationsChanged()
      showSuccess(integration.isActive ? 'Takealot connection disabled' : 'Takealot connection enabled')
    } catch (cause) {
      showError('Unable to update Takealot connection', cause)
    }
  }

  const remove = async (integration: Integration) => {
    if (
      !window.confirm(
        `Remove the Takealot connection "${integration.name}"? Its synced offer data will also be removed.`,
      )
    ) {
      return
    }
    try {
      await deleteIntegration(integration.id)
      if (editingId === integration.id) resetForm()
      await reload()
      dispatchIntegrationsChanged()
      showSuccess('Takealot connection removed')
    } catch (cause) {
      showError('Unable to remove Takealot connection', cause)
    }
  }

  const edit = (integration: Integration) => {
    setEditingId(integration.id)
    setName(integration.name)
    setApiKey('')
    setSellerId(integration.sellerId ?? '')
    setThreshold(String(integration.lowStockThreshold))
    setError('')
  }

  return (
    <VStack align="stretch" gap="5">
      <HStack justify="space-between" flexWrap="wrap" gap="3">
        <Box>
          <Heading size="sm">Takealot integrations</Heading>
          <Text fontSize="sm" color="secondary">
            Manage separate seller connections. API keys are stored securely and never shown after saving.
          </Text>
        </Box>
        <Button size="sm" variant="outline" onClick={() => void reload()} loading={loading}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </HStack>

      <Card.Root variant="outline">
        <Card.Body>
          <VStack align="stretch" gap="4">
            <Heading size="xs">{editingId ? 'Edit connection' : 'Add a Takealot connection'}</Heading>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="4">
              <Field.Root required>
                <Field.Label>Connection name</Field.Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Main store" />
              </Field.Root>
              <Field.Root required={!editingId}>
                <Field.Label>{editingId ? 'Replace API key (optional)' : 'API key'}</Field.Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={editingId ? 'Leave blank to keep the saved key' : 'Enter Takealot API key'}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Seller ID (optional)</Field.Label>
                <Input value={sellerId} onChange={(event) => setSellerId(event.target.value)} />
              </Field.Root>
              <Field.Root>
                <Field.Label>Low-stock threshold (units)</Field.Label>
                <Input
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                />
              </Field.Root>
            </Grid>
            {error && (
              <Text role="alert" color="fg.error" fontSize="sm">
                {error}
              </Text>
            )}
            <HStack justify="flex-end">
              {editingId && (
                <Button variant="outline" onClick={resetForm} disabled={saving}>
                  <X size={15} /> Cancel
                </Button>
              )}
              <Button onClick={() => void save()} loading={saving}>
                {editingId ? <Check size={15} /> : <Plus size={15} />}
                {editingId ? 'Save connection' : 'Add connection'}
              </Button>
            </HStack>
          </VStack>
        </Card.Body>
      </Card.Root>

      {loading && integrations.length === 0 && (
        <Text fontSize="sm" color="secondary">
          Loading connections…
        </Text>
      )}
      {!loading && integrations.length === 0 && (
        <Card.Root variant="outline">
          <Card.Body>
            <Text fontSize="sm" color="secondary">
              No Takealot connections yet. Add one above to enable the dashboard and offer lookup.
            </Text>
          </Card.Body>
        </Card.Root>
      )}
      <VStack align="stretch" gap="3">
        {integrations.map((integration) => (
          <Card.Root key={integration.id} variant="outline">
            <Card.Body>
              <HStack justify="space-between" align="start" flexWrap="wrap" gap="3">
                <Box>
                  <HStack mb="1">
                    <Text fontWeight="semibold">{integration.name}</Text>
                    <Badge colorPalette={integration.isActive ? 'green' : 'gray'}>
                      {integration.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                    <Badge colorPalette={integration.configured ? 'blue' : 'orange'}>
                      {integration.configured ? 'Key configured' : 'Missing API key'}
                    </Badge>
                  </HStack>
                  <Text fontSize="sm" color="secondary">
                    Seller ID: {integration.sellerId || 'Not set'} · Low-stock alert: {integration.lowStockThreshold}{' '}
                    units
                  </Text>
                </Box>
                <HStack flexWrap="wrap">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => void test(integration)}
                    loading={testingId === integration.id}
                    disabled={!integration.configured}
                  >
                    Test
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => edit(integration)}>
                    <Pencil size={13} /> Edit
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => void toggleActive(integration)}>
                    {integration.isActive ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="xs" variant="outline" colorPalette="red" onClick={() => void remove(integration)}>
                    <Trash2 size={13} /> Remove
                  </Button>
                </HStack>
              </HStack>
            </Card.Body>
          </Card.Root>
        ))}
      </VStack>
    </VStack>
  )
}
