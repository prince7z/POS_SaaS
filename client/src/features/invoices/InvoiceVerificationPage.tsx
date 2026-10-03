import { useEffect, useState } from 'react'
import { Box, Button, Card, Grid, Heading, HStack, Separator, Skeleton, Table, Text, VStack } from '@chakra-ui/react'
import { Download, Printer } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { getPublicInvoice, type InvoiceDetail } from '@/api/endpoints/invoices'
import QRCode from 'qrcode'
import { formatInvoiceTime } from './invoiceFormatting'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const money = (value: number) => value.toFixed(2)

export function InvoiceVerificationPage() {
  const { invoiceid } = useParams()
  const [invoice, setInvoice] = useState<
    (InvoiceDetail & { company: NonNullable<Awaited<ReturnType<typeof getPublicInvoice>>['company']> }) | null
  >(null)
  const [qrCode, setQrCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!invoiceid) return
    getPublicInvoice(invoiceid)
      .then(setInvoice)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Invoice could not be found.'))
  }, [invoiceid])

  useEffect(() => {
    if (!invoice?.invoiceNumber) return
    QRCode.toDataURL(`${window.location.origin}/invoice-verification/${invoice.invoiceNumber}`, {
      margin: 1,
      width: 112,
    })
      .then(setQrCode)
      .catch(() => setQrCode(''))
  }, [invoice?.invoiceNumber])

  const downloadInvoice = async () => {
    if (!invoice) return
    const element = document.querySelector<HTMLElement>('.public-invoice')
    if (!element) return

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imageHeight = (canvas.height * pageWidth) / canvas.width
    let remainingHeight = imageHeight
    let offset = 0

    while (remainingHeight > 0) {
      if (offset > 0) pdf.addPage()
      pdf.addImage(canvas, 'PNG', 0, offset, pageWidth, imageHeight)
      remainingHeight -= pageHeight
      offset -= pageHeight
    }
    pdf.save(`${invoice.invoiceNumber ?? 'invoice'}.pdf`)
  }

  if (error)
    return (
      <Box maxW="xl" mx="auto" p="8">
        <Heading size="md">Invoice unavailable</Heading>
        <Text mt="2">{error}</Text>
      </Box>
    )
  if (!invoice)
    return (
      <Box maxW="xl" mx="auto" p="8">
        <Skeleton h="96" />
      </Box>
    )

  return (
    <Box maxW="3xl" mx="auto" p={{ base: '4', md: '8' }}>
      <HStack className="actions" justify="flex-end" mb="4">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer size={16} />
          Print / Save PDF
        </Button>
        <Button onClick={downloadInvoice}>
          <Download size={16} />
          Download
        </Button>
      </HStack>
      <Card.Root variant="outline" className="public-invoice invoice-preview">
        <Card.Body p={{ base: '5', md: '8' }}>
          <VStack align="stretch" gap="5">
            <Grid
              className="invoice-preview-header"
              templateColumns={{ base: '1fr', md: '1fr auto' }}
              gap="4"
              alignItems="start"
            >
              <Box>
                {invoice.company.logoUrl && (
                  <img
                    src={invoice.company.logoUrl}
                    alt={invoice.company.name}
                    style={{ maxHeight: 48, maxWidth: 180, objectFit: 'contain' }}
                  />
                )}
                <Heading size="md" mt="2">
                  {invoice.company.name}
                </Heading>
                <Text fontSize="sm" color="secondary">
                  {[invoice.company.addressLine1, invoice.company.city, invoice.company.phone]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {invoice.company.businessHours && (
                  <Box fontSize="xs" color="secondary" mt="3">
                    <Text fontWeight="400" color="secondary">
                      Opening hours
                    </Text>
                    <Text>
                      Weekdays: {formatInvoiceTime(invoice.company.businessHours.weekdays.open)} –{' '}
                      {formatInvoiceTime(invoice.company.businessHours.weekdays.close)}
                    </Text>
                  </Box>
                )}
              </Box>
              <VStack className="invoice-preview-meta" align={{ base: 'start', md: 'end' }} gap="1">
              <Heading size="sm">Invoice</Heading>

                {qrCode && <img src={qrCode} alt="Invoice verification QR code" width={88} height={88} />}
                <Text>{invoice.invoiceNumber}</Text>
                <Text fontSize="xs" color="secondary">
                  Copy — not original
                </Text>
              </VStack>
            </Grid>
            <Separator />
            <Box>
              <Text fontSize="xs" color="secondary">
                Billed to
              </Text>
              <Text fontWeight="600">{invoice.customer?.name ?? 'Walk-in customer'}</Text>
              <Text fontSize="sm" color="secondary">
                {invoice.customer?.email ?? invoice.customer?.phone ?? 'No contact details'}
              </Text>
            </Box>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Item</Table.ColumnHeader>
                  <Table.ColumnHeader>Qty</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Price</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Total</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {invoice.items.map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell>
                      <Text fontWeight="600">{item.productName}</Text>
                      <Text fontSize="xs" color="secondary">
                        {item.sku}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>{item.quantity}</Table.Cell>
                    <Table.Cell textAlign="end">{money(item.unitPrice)}</Table.Cell>
                    <Table.Cell textAlign="end">{money(item.lineSubtotal)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
            <Box ml="auto" w="full" maxW="xs" mb="6">
              <Text display="flex" justifyContent="space-between">
                Subtotal <span>{money(invoice.subtotal)}</span>
              </Text>
              <Text display="flex" justifyContent="space-between">
                Tax <span>{money(invoice.taxAmount)}</span>
              </Text>
              {invoice.discountAmount > 0 && (
                <Text display="flex" justifyContent="space-between">
                  Discount <span>-{money(invoice.discountAmount)}</span>
                </Text>
              )}
              <Text display="flex" justifyContent="space-between" fontWeight="700">
                Total <span>{money(invoice.total)}</span>
              </Text>
            </Box>
            {invoice.notes && (
              <Box mt="2" mb="6">
                <Text fontWeight="600" fontSize="sm">
                  Notes
                </Text>
                <Text fontSize="sm">{invoice.notes}</Text>
              </Box>
            )}
            {invoice.company.invoiceTerms.length > 0 && (
              <Box pt="5" borderTopWidth="1px" fontSize="xs">
                <Text fontWeight="600" fontSize="sm">
                  Terms and conditions
                </Text>
                {invoice.company.invoiceTerms.map((term) => (
                  <Text key={term}>• {term}</Text>
                ))}
              </Box>
            )}
            <Box textAlign="center" pt="3">
                      <Separator mb="3" />

              <Text fontWeight="400">Thank you for shopping with {invoice.company.name}.</Text>

            </Box>
          </VStack>
        </Card.Body>
      </Card.Root>
    </Box>
  )
}
