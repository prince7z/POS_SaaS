import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Flex } from '@chakra-ui/react'
import { useAgentStream } from '../hooks/useAgentStream'
import { AgentChat } from './AgentChat'
import { AgentComposer } from './AgentComposer'
import { AgentHeader } from './AgentHeader'
import { ConversationHistory } from './ConversationHistory'

export function AgentPanel({
  isOpen,
  onClose,
  width,
  onWidthChange,
}: {
  isOpen: boolean
  onClose: () => void
  width: number
  onWidthChange: (w: number) => void
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(width)

  const {
    messages,
    isStreaming,
    activeConversationId,
    loadConversation,
    createNewConversation,
    sendMessage,
    stopStream,
    handleInteraction,
  } = useAgentStream()

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDraggingRef.current = true
      startXRef.current = e.clientX
      startWidthRef.current = width
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [width],
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const deltaX = startXRef.current - e.clientX
      const nextWidth = Math.min(Math.max(startWidthRef.current + deltaX, 320), Math.min(850, window.innerWidth * 0.55))
      onWidthChange(nextWidth)
    }

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onWidthChange])

  if (!isOpen) return null

  return (
    <Flex
      position="relative"
      w={`${width}px`}
      h="100vh"
      direction="column"
      bg="surface"
      borderLeftWidth="1px"
      borderColor="border"
      shadow="md"
      zIndex="20"
      shrink={0}
      className="transition-none"
    >
      {/* Horizontal Resize Drag Handle */}
      <Box
        position="absolute"
        top="0"
        left="-4px"
        w="8px"
        h="full"
        cursor="col-resize"
        zIndex="30"
        onMouseDown={handleMouseDown}
        _hover={{ bg: 'blue.400' }}
        opacity="0.3"
        transition="opacity 0.2s"
      />

      <AgentHeader
        historyOpen={historyOpen}
        onToggleHistory={() => setHistoryOpen((prev) => !prev)}
        onNewChat={createNewConversation}
        onClose={onClose}
      />

      {historyOpen && (
        <ConversationHistory
          activeId={activeConversationId}
          onSelectConversation={(item) => {
            loadConversation(item.id)
            setHistoryOpen(false)
          }}
        />
      )}

      <AgentChat
        messages={messages}
        conversationId={activeConversationId || 'conv_active'}
        isStreaming={isStreaming}
        onRespond={handleInteraction}
        onSuggestionClick={(prompt) => sendMessage(prompt)}
      />

      <AgentComposer
        isStreaming={isStreaming}
        onSend={(text) => sendMessage(text)}
        onStop={stopStream}
      />
    </Flex>
  )
}
