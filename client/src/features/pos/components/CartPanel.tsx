import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Mail, ShoppingCart, Trash2 } from 'lucide-react'
import type { CartItem as CartItemType, Customer, SaleDiscountType, SalePaymentMethod, SaleTotals } from '../types'
import { CartItem } from './CartItem'
import { CustomerSelector } from './CustomerSelector'
import { DiscountSelector } from './DiscountSelector'
import { PaymentMethodSelector } from './PaymentMethodSelector'
import { CartSummary } from './CartSummary'

const MotionBox = motion.create(Box)

export function CartPanel({
  cart,
  customers,
  selectedCustomerId,
  onSelectCustomer,
  discountType,
  discountValue,
  onDiscountTypeChange,
  onDiscountValueChange,
  paymentMethod,
  onPaymentMethodChange,
  notifyCustomer,
  onToggleNotifyCustomer,
  recipientType,
  onRecipientTypeChange,
  customEmail,
  onCustomEmailChange,
  totals,
  submitting,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onSubmitSale,
}: {
  cart: CartItemType[]
  customers: Customer[]
  selectedCustomerId: string | null
  onSelectCustomer: (customerId: string | null) => void
  discountType: SaleDiscountType | null
  discountValue: number
  onDiscountTypeChange: (type: SaleDiscountType | null) => void
  onDiscountValueChange: (value: number) => void
  paymentMethod: SalePaymentMethod
  onPaymentMethodChange: (method: SalePaymentMethod) => void
  notifyCustomer: boolean
  onToggleNotifyCustomer: () => void
  recipientType: 'CUSTOMER' | 'OTHER'
  onRecipientTypeChange: (type: 'CUSTOMER' | 'OTHER') => void
  customEmail: string
  onCustomEmailChange: (email: string) => void
  totals: SaleTotals
  submitting: boolean
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemoveItem: (id: string) => void
  onClearCart: () => void
  onSubmitSale: () => void
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const handleClearClick = () => {
    if (showClearConfirm) {
      onClearCart()
      setShowClearConfirm(false)
    } else {
      setShowClearConfirm(true)
      setTimeout(() => setShowClearConfirm(false), 3000)
    }
  }

  return (
    <Card.Root
      variant="outline"
      borderRadius="md"
      position={{ base: 'static', xl: 'fixed' }}
      top={{ base: 'auto', xl: '84px' }}
      right={{ base: 'auto', xl: '24px' }}
      w={{ base: 'full', xl: '350px' }}
      h={{ base: 'auto', xl: 'calc(100vh - 104px)' }}
      zIndex="10"
      bg="bg.panel"
      display="flex"
      flexDirection="column"
      shadow="sm"
    >
      <Card.Header py="2.5" px="3.5" borderBottomWidth="1px" borderColor="border" flexShrink={0}>
        <Flex justify="space-between" align="center">
          <Box>
            <Text fontWeight="700" fontSize="sm">
              Current Cart
            </Text>
            <Text fontSize="xs" color="fg.subtle">
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
            </Text>
          </Box>
          {cart.length > 0 && (
            <Button
              size="xs"
              variant={showClearConfirm ? 'solid' : 'ghost'}
              colorPalette="red"
              onClick={handleClearClick}
            >
              <Trash2 size={13} />
              {showClearConfirm ? 'Confirm Clear?' : 'Clear cart'}
            </Button>
          )}
        </Flex>
      </Card.Header>

      <Card.Body p="3" display="flex" flexDirection="column" flex="1" overflow="hidden">
        {!cart.length ? (
          <VStack py="12" gap="3" textAlign="center" my="auto">
            <Box p="3" borderRadius="full" bg="bg.muted" color="fg.muted">
              <ShoppingCart size={26} />
            </Box>
            <VStack gap="1">
              <Text fontWeight="600" fontSize="sm">
                Your cart is empty
              </Text>
              <Text color="fg.subtle" fontSize="xs" maxW="200px">
                Search or click on a product card to add items to this sale.
              </Text>
            </VStack>
          </VStack>
        ) : (
          <Flex direction="column" h="full" gap="2.5" overflow="hidden">
            {/* Scrollable Cart Items List */}
            <Box flex="1" minH="0" overflowY="auto" pr="1.5">
              <AnimatePresence initial={false}>
                {cart.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onQuantity={(quantity) => onUpdateQuantity(item.id, quantity)}
                    onRemove={() => onRemoveItem(item.id)}
                  />
                ))}
              </AnimatePresence>
            </Box>

            {/* Pinned Bottom Controls & Checkout */}
            <VStack align="stretch" gap="2" pt="2" borderTopWidth="1px" borderColor="border" flexShrink={0}>
              {/* Discount Section */}
              <VStack align="stretch" gap="1">
                <Text fontSize="10px" fontWeight="700" color="fg.subtle" textTransform="uppercase" letterSpacing="0.05em">
                  Discount
                </Text>
                <DiscountSelector
                  discountType={discountType}
                  discountValue={discountValue}
                  onDiscountTypeChange={onDiscountTypeChange}
                  onDiscountValueChange={onDiscountValueChange}
                />
              </VStack>

              {/* Customer Section */}
              <VStack align="stretch" gap="1">
                <Text fontSize="10px" fontWeight="700" color="fg.subtle" textTransform="uppercase" letterSpacing="0.05em">
                  Customer
                </Text>
                <CustomerSelector
                  customers={customers}
                  selectedCustomerId={selectedCustomerId}
                  onSelectCustomer={onSelectCustomer}
                />
              </VStack>

              {/* Payment Method Section */}
              <VStack align="stretch" gap="1">
                <Text fontSize="10px" fontWeight="700" color="fg.subtle" textTransform="uppercase" letterSpacing="0.05em">
                  Payment Method
                </Text>
                <PaymentMethodSelector
                  value={paymentMethod}
                  onChange={onPaymentMethodChange}
                />
              </VStack>

              {/* Email Receipt Option */}
              <Box py="1" borderTopWidth="1px" borderBottomWidth="1px" borderColor="border">
                <HStack justify="space-between" cursor="pointer" onClick={onToggleNotifyCustomer}>
                  <HStack gap="1.5">
                    <Mail size={14} color="var(--chakra-colors-blue-500)" />
                    <Text fontSize="xs" fontWeight="600">
                      Email Receipt
                    </Text>
                  </HStack>
                  <Button
                    size="2xs"
                    variant={notifyCustomer ? 'solid' : 'outline'}
                    colorPalette={notifyCustomer ? 'blue' : undefined}
                  >
                    {notifyCustomer ? 'Enabled' : 'Off'}
                  </Button>
                </HStack>

                <AnimatePresence>
                  {notifyCustomer && (
                    <MotionBox
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      overflow="hidden"
                      mt="2"
                    >
                      <VStack align="stretch" gap="1.5">
                        <HStack gap="1.5">
                          <Button
                            size="2xs"
                            flex="1"
                            variant={recipientType === 'CUSTOMER' ? 'solid' : 'outline'}
                            onClick={() => onRecipientTypeChange('CUSTOMER')}
                          >
                            Customer Email
                          </Button>
                          <Button
                            size="2xs"
                            flex="1"
                            variant={recipientType === 'OTHER' ? 'solid' : 'outline'}
                            onClick={() => onRecipientTypeChange('OTHER')}
                          >
                            Other Email
                          </Button>
                        </HStack>
                        {recipientType === 'OTHER' && (
                          <Input
                            size="xs"
                            type="email"
                            placeholder="Enter recipient email..."
                            value={customEmail}
                            onChange={(e) => onCustomEmailChange(e.target.value)}
                          />
                        )}
                      </VStack>
                    </MotionBox>
                  )}
                </AnimatePresence>
              </Box>

              {/* Totals Summary */}
              <CartSummary totals={totals} />

              {/* Complete Sale Action */}
              <Button
                size="sm"
                colorPalette="blue"
                w="full"
                loading={submitting}
                onClick={onSubmitSale}
                fontWeight="600"
              >
                <Check size={15} />
                Complete Sale
              </Button>
            </VStack>
          </Flex>
        )}
      </Card.Body>
    </Card.Root>
  )
}
