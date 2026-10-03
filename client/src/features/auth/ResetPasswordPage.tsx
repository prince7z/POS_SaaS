import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Heading,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react'
import { motion } from 'motion/react'
import { CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { resetPassword } from '@/api/endpoints/auth'

const MotionCard = motion.create(Card.Root)
const MotionBox = motion.create(Box)

export function ResetPasswordPage() {
  const { token: routeToken } = useParams<{ token?: string }>()
  const [searchParams] = useSearchParams()
  const token = routeToken || searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError('Invalid or missing password reset token.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await resetPassword({
        token,
        newPassword,
        confirmPassword,
      })
      setIsSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. The link may have expired.')
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
            <ShieldCheck size={24} />
          </MotionBox>
          <Heading size="lg" fontWeight="700">
            Set New Password
          </Heading>
          <Text color="secondary" fontSize="sm" mt="1">
            Please enter and confirm your new account password below.
          </Text>
        </Card.Header>

        <Card.Body pt="2" pb="8">
          {isSuccess ? (
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
                  <Alert.Title fontWeight="600">Password reset complete</Alert.Title>
                  <Alert.Description fontSize="sm" mt="1">
                    Your password has been successfully updated. You can now log in with your new password.
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
              <Button colorPalette="blue" size="lg" w="full" onClick={() => navigate('/auth/login')}>
                Go to Login
              </Button>
            </MotionBox>
          ) : (
            <form onSubmit={handleSubmit}>
              <VStack align="stretch" gap="4">
                {!token && (
                  <Alert.Root status="warning" size="sm" borderRadius="md">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>No reset token found in URL. Please check your reset link.</Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                )}

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
                    New Password
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
                    <Lock size={16} color="var(--chakra-colors-secondary)" />
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      border="none"
                      outline="none"
                      focusRing="none"
                      fontSize="sm"
                      py="1.5"
                    />
                    <IconButton
                      aria-label="Toggle new password visibility"
                      size="xs"
                      variant="ghost"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </IconButton>
                  </HStack>
                </Box>

                <Box>
                  <Text fontSize="sm" fontWeight="600" mb="1.5">
                    Confirm New Password
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
                    <Lock size={16} color="var(--chakra-colors-secondary)" />
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      border="none"
                      outline="none"
                      focusRing="none"
                      fontSize="sm"
                      py="1.5"
                    />
                    <IconButton
                      aria-label="Toggle confirm password visibility"
                      size="xs"
                      variant="ghost"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </IconButton>
                  </HStack>
                </Box>

                <Button
                  type="submit"
                  colorPalette="blue"
                  size="lg"
                  w="full"
                  loading={loading}
                  disabled={!token}
                  mt="2"
                >
                  Update Password
                </Button>

                <HStack justify="center" pt="2">
                  <Link
                    to="/auth/login"
                    style={{ fontSize: '0.85rem', textDecoration: 'none', color: 'var(--chakra-colors-secondary)' }}
                  >
                    Cancel & Return to Login
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
