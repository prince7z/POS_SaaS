import { Text } from '@chakra-ui/react'

export function FormLabelIndicator({ required = false }: { required?: boolean }) {
  return (
    <Text
      as="span"
      ml="1"
      color={required ? 'red.500' : 'secondary'}
      fontSize={required ? 'sm' : 'xs'}
      fontWeight="normal"
      aria-hidden="true"
    >
      {required ? '*' : '(optional)'}
    </Text>
  )
}
