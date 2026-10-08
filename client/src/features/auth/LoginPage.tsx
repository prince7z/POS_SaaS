import { useEffect, useState } from 'react'
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
import { Eye, EyeOff, Lock, LogIn, Mail, Sparkles } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { login } from '@/api/endpoints/auth'
import { setAuthSession } from '@/lib/auth'

const MotionCard = motion.create(Card.Root)
const MotionBox = motion.create(Box)

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const isDemoQuery = searchParams.get('demo') === '1' || searchParams.get('demo') === 'true'

  const [email, setEmail] = useState(isDemoQuery ? 'Demo@pcodes.tech' : '')
  const [password, setPassword] = useState(isDemoQuery ? 'Demo@123' : '')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (isDemoQuery) {
      setEmail('Demo@pcodes.tech')
      setPassword('Demo@123')
    }
  }, [isDemoQuery])

  const fillDemoCredentials = () => {
    setEmail('Demo@pcodes.tech')
    setPassword('Demo@123')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Please fill in all required login fields.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await login({
        email: email.trim().toLowerCase(),
        password,
      })

      // Store auth session tokens & cookies
      setAuthSession(response)

      // Redirect to main POS app dashboard
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.')
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
            bg="white"
            color="black"
            border="1px solid"
            borderColor="zinc.300"
            display="grid"
            placeItems="center"
            fontWeight="900"
            fontSize="xs"
            style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
          >
            Jcom
          </MotionBox>
          <Heading size="lg" fontWeight="800" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
            Sign in to Jcom
          </Heading>
          <Text color="secondary" fontSize="sm" mt="1">
            Enter your user credentials to access your store workspace.
          </Text>
        </Card.Header>

        <Card.Body pt="2" pb="8">
          <form onSubmit={handleLogin}>
            <VStack align="stretch" gap="3.5">
              {error && (
                <Alert.Root status="error" size="sm" borderRadius="md">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              )}

              {/* Email Field */}
              <Box>
                <Text fontSize="sm" fontWeight="600" mb="1.5">
                  Email Address
                </Text>
                <HStack
                  gap="2"
                  border="1px solid"
                  borderColor="border"
                  borderRadius="md"
                  px="3"
                  py="1"
                  _focusWithin={{ borderColor: 'zinc.900' }}
                >
                  <Mail size={16} color="var(--chakra-colors-secondary)" />
                  <Input
                    type="email"
                    required
                    placeholder="user@company.com"
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

              {/* Password Field */}
              <Box>
                <Text fontSize="sm" fontWeight="600" mb="1.5">
                  Password
                </Text>
                <HStack
                  gap="2"
                  border="1px solid"
                  borderColor="border"
                  borderRadius="md"
                  px="3"
                  py="1"
                  _focusWithin={{ borderColor: 'zinc.900' }}
                >
                  <Lock size={16} color="var(--chakra-colors-secondary)" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    border="none"
                    outline="none"
                    focusRing="none"
                    fontSize="sm"
                    py="1.5"
                  />
                  <IconButton
                    aria-label="Toggle password visibility"
                    size="xs"
                    variant="ghost"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </IconButton>
                </HStack>
              </Box>

              {/* Forgot Password Link */}
              <HStack justify="flex-end" pt="0.5">
                <Link
                  to="/auth/forgot-password"
                  style={{ fontSize: '0.8rem', color: '#18181b', textDecoration: 'underline', fontWeight: 500 }}
                >
                  Forgot password?
                </Link>
              </HStack>

              {/* Demo Credentials Card rendered ONLY if ?demo=true or ?demo=1 is in URL */}
              {isDemoQuery && (
                <Box
                  p="3"
                  borderRadius="md"
                  bg="zinc.50"
                  border="1px solid"
                  borderColor="zinc.200"
                  fontSize="xs"
                >
                  <HStack justify="space-between" align="center">
                    <HStack gap="2">
                      <Sparkles size={14} color="#18181b" />
                      <Text fontWeight="600" color="zinc.900">
                        Demo Account Available
                      </Text>
                    </HStack>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={fillDemoCredentials}
                    >
                      Auto-Fill Demo
                    </Button>
                  </HStack>
                  <Text color="zinc.600" mt="1" fontSize="xs">
                    Email: <strong>Demo@pcodes.tech</strong> &bull; Password: <strong>Demo@123</strong>
                  </Text>
                </Box>
              )}

              {/* Sign In Button */}
              <Button
                type="submit"
                colorPalette="gray"
                bg="zinc.900"
                color="white"
                _hover={{ bg: 'zinc.800' }}
                size="lg"
                w="full"
                loading={loading}
                mt="1"
              >
                <LogIn size={16} />
                Sign In
              </Button>
            </VStack>
          </form>
        </Card.Body>
      </MotionCard>
    </Container>
  )
}
