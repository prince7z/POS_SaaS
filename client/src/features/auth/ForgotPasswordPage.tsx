import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Heading,
  HStack,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react'
import { motion } from 'motion/react'
import { ArrowLeft, CheckCircle2, KeyRound, Mail, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '@/api/endpoints/auth'

const MotionCard = motion.create(Card.Root)
const MotionBox = motion.create(Box)

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const response = await forgotPassword(email.trim().toLowerCase())
      setSuccessMessage(response.message || 'Password reset link has been sent to your email.')
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while requesting password reset.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxW="md" py={{ base: '10', md: '16' }}>
      <MotionCard
        variant="outline"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        borderRadius="lg"
      >
        <Card.Header textAlign="center" pt="8" pb="3">
          <MotionBox
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            mx="auto"
            mb="3"
            w="12"
            h="12"
            borderRadius="lg"
            bg="blue.subtle"
            color="blue.solid"
            display="grid"
            placeItems="center"
          >
            <KeyRound size={24} />
          </MotionBox>
          <Heading size="lg" fontWeight="700">
            Forgot Password?
          </Heading>
          <Text color="secondary" fontSize="sm" mt="1">
            Enter your account email address and we'll send you instructions to reset your password.
          </Text>
        </Card.Header>

        <Card.Body pt="2" pb="8">
          {successMessage ? (
            <MotionBox
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Alert.Root status="success" variant="subtle" borderRadius="md" p="4" mb="6">
                <Alert.Indicator>
                  <CheckCircle2 size={20} />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title fontWeight="600">Check your inbox</Alert.Title>
                  <Alert.Description fontSize="sm" mt="1">
                    {successMessage}
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
              <Button asChild variant="outline" w="full" size="md">
                <Link to="/auth/login">
                  <ArrowLeft size={16} />
                  Return to Login
                </Link>
              </Button>
            </MotionBox>
          ) : (
            <form onSubmit={handleSubmit}>
              <VStack align="stretch" gap="4">
                {error && (
                  <Alert.Root status="error" size="sm" borderRadius="md">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>{error}</Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                )}

                <Box>
                  <Text fontSize="sm" fontWeight="600" mb="1.5">
                    Email address
                  </Text>
                  <HStack
                    gap="2"
                    border="1px solid"
                    borderColor="border"
                    borderRadius="md"
                    px="3"
                    py="1"
                    _focusWithin={{ borderColor: 'blue.solid' }}
                  >
                    <Mail size={16} color="var(--chakra-colors-secondary)" />
                    <Input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      border="none"
                      outline="none"
                      focusRing="none"
                      fontSize="sm"
                      py="1.5"
                    />
                  </HStack>
                </Box>

                <Button
                  type="submit"
                  colorPalette="blue"
                  size="lg"
                  w="full"
                  loading={loading}
                  mt="2"
                >
                  <Send size={16} />
                  Send Reset Link
                </Button>

                <HStack justify="center" pt="2">
                  <Link
                    to="/auth/login"
                    style={{ fontSize: '0.85rem', textDecoration: 'none', color: 'var(--chakra-colors-blue-solid)' }}
                  >
                    <HStack gap="1">
                      <ArrowLeft size={14} />
                      <Text fontWeight="500">Back to Login</Text>
                    </HStack>
                  </Link>
                </HStack>
              </VStack>
            </form>
          )}
        </Card.Body>
      </MotionCard>
    </Container>
  )
}
