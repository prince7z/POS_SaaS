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
import { Building2, Eye, EyeOff, KeyRound, Lock, LogIn, Mail, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '@/api/endpoints/auth'
import { setAuthSession } from '@/lib/auth'

const MotionCard = motion.create(Card.Root)
const MotionBox = motion.create(Box)

export function LoginPage() {
  const [companyId, setCompanyId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId.trim() || !email.trim() || !password) {
      setError('Please fill in all required login fields.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await login({
        companyId: companyId.trim(),
        email: email.trim().toLowerCase(),
        password,
      })

      // Store auth session tokens & cookies
      setAuthSession(response)

      // Redirect to main POS app
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid company ID, email, or password.')
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
            <LogIn size={24} />
          </MotionBox>
          <Heading size="lg" fontWeight="700">
            Sign in to POS SaaS
          </Heading>
          <Text color="secondary" fontSize="sm" mt="1">
            Enter your company ID and user credentials to access your store workspace.
          </Text>
        </Card.Header>

        <Card.Body pt="2" pb="8">
          <form onSubmit={handleLogin}>
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
                <HStack justify="space-between" mb="1.5">
                  <Text fontSize="sm" fontWeight="600">
                    Company ID
                  </Text>
                </HStack>
                <HStack
                  gap="2"
                  border="1px solid"
                  borderColor="border"
                  borderRadius="md"
                  px="3"
                  py="1"
                  _focusWithin={{ borderColor: 'blue.solid' }}
                >
                  <Building2 size={16} color="var(--chakra-colors-secondary)" />
                  <Input
                    type="text"
                    required
                    placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    border="none"
                    outline="none"
                    focusRing="none"
                    fontSize="sm"
                    py="1.5"
                  />
                </HStack>
              </Box>

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
                  _focusWithin={{ borderColor: 'blue.solid' }}
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

              <Box>
                <HStack justify="space-between" mb="1.5">
                  <Text fontSize="sm" fontWeight="600">
                    Password
                  </Text>
                  <Link
                    to="/auth/forgot-password"
                    style={{ fontSize: '0.8rem', color: 'var(--chakra-colors-blue-solid)', textDecoration: 'none' }}
                  >
                    Forgot password?
                  </Link>
                </HStack>
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

              <Button
                type="submit"
                colorPalette="blue"
                size="lg"
                w="full"
                loading={loading}
                mt="2"
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
