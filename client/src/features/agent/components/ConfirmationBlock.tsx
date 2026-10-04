import { Box, Button, HStack, Text } from '@chakra-ui/react'
import { AlertTriangle, Check, X } from 'lucide-react'
import type { ConfirmationBlock as ConfirmationBlockType, InteractionPayload } from '../types/agent'

export function ConfirmationBlock({
  block,
  conversationId,
  onRespond,
}: {
  block: ConfirmationBlockType
  conversationId: string
  onRespond: (payload: InteractionPayload) => void
}) {
  const { data, answered, approved } = block

  const handleChoice = (value: boolean) => {
    if (answered) return
    onRespond({
      conversationId,
      confirmationId: data.confirmationId,
      response: {
        type: 'option',
        value,
      },
    })
  }

  return (
    <Box p="3.5" bg="surface" borderWidth="1.5px" borderColor="warning" borderRadius="lg" my="2.5" shadow="sm">
      <HStack gap="2" mb="2">
        <AlertTriangle size={17} className="text-amber-600" />
        <Text fontSize="xs" fontWeight="bold" color="foreground">
          {data.action?.label || 'Action Confirmation Required'}
        </Text>
      </HStack>

      <Text fontSize="xs" color="foreground" mb="3">
        {data.message}
      </Text>

      {answered ? (
        <Box p="2" bg="background" borderRadius="md" borderWidth="1px">
          <Text fontSize="xs" color="secondary">
            Decision:{' '}
            <Text as="span" fontWeight="semibold" color={approved ? 'success' : 'danger'}>
              {approved ? 'Approved & Executed' : 'Cancelled'}
            </Text>
          </Text>
        </Box>
      ) : (
        <HStack gap="3" justify="flex-end">
          <Button
            size="xs"
            variant="outline"
            colorPalette="red"
            onClick={() => handleChoice(false)}
            px="3"
          >
            <X size={13} className="mr-1" />
            Cancel
          </Button>
          <Button
            size="xs"
            colorScheme="blue"
            onClick={() => handleChoice(true)}
            px="3"
          >
            <Check size={13} className="mr-1" />
            Approve
          </Button>
        </HStack>
      )}
    </Box>
  )
}
