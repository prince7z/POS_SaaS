import { useState } from 'react'
import { Box, Button, HStack, Input, Stack, Text } from '@chakra-ui/react'
import { HelpCircle, Send } from 'lucide-react'
import type { InteractionPayload, QuestionBlock as QuestionBlockType } from '../types/agent'

export function QuestionBlock({
  block,
  conversationId,
  onRespond,
}: {
  block: QuestionBlockType
  conversationId: string
  onRespond: (payload: InteractionPayload) => void
}) {
  const { data, answered, selectedResponse } = block
  const [textInput, setTextInput] = useState('')

  const handleSelectOption = (value: string) => {
    if (answered) return
    onRespond({
      conversationId,
      questionId: data.questionId,
      response: {
        type: 'option',
        value,
      },
    })
  }

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim() || answered) return
    onRespond({
      conversationId,
      questionId: data.questionId,
      response: {
        type: 'text',
        value: textInput.trim(),
      },
    })
  }

  return (
    <Box p="3.5" bg="surface" borderWidth="1.5px" borderColor="primary" borderRadius="lg" my="2.5" shadow="sm">
      <HStack gap="2" mb="2">
        <HelpCircle size={17} className="text-blue-600" />
        <Text fontSize="xs" fontWeight="bold" color="foreground">
          Question from Assistant
        </Text>
      </HStack>

      <Text fontSize="xs" color="foreground" mb="3">
        {data.message}
      </Text>

      {answered ? (
        <Box p="2" bg="background" borderRadius="md" borderWidth="1px">
          <Text fontSize="xs" color="secondary">
            Selected Answer: <Text as="span" fontWeight="semibold" color="primary">{selectedResponse}</Text>
          </Text>
        </Box>
      ) : (
        <Stack gap="2">
          {data.options && data.options.length > 0 && (
            <HStack gap="2" flexWrap="wrap">
              {data.options.map((opt) => (
                <Button
                  key={opt.id}
                  size="xs"
                  variant="outline"
                  onClick={() => handleSelectOption(opt.value)}
                  className="hover:bg-blue-50 border-blue-200 text-blue-700"
                >
                  {opt.label}
                </Button>
              ))}
            </HStack>
          )}

          {data.allowTextInput && (
            <form onSubmit={handleTextSubmit}>
              <HStack gap="2" mt="1">
                <Input
                  size="xs"
                  placeholder="Or type custom answer..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={answered}
                />
                <Button size="xs" type="submit" disabled={!textInput.trim() || answered} colorScheme="blue">
                  <Send size={12} />
                </Button>
              </HStack>
            </form>
          )}
        </Stack>
      )}
    </Box>
  )
}
