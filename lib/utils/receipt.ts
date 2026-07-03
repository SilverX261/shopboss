// Shared receipt/invoice PDF generator — used by the post-sale success screen
// and the "Print" action on the sales history page. Uses @react-pdf/renderer,
// the same PDF library already used for the daily report export.

export interface ReceiptData {
  shopName: string
  whatsappNumber?: string | null
  soldAt: string // ISO timestamp
  brand: string
  model: string
  processor?: string | null
  ram?: string | null
  storage?: string | null
  imei?: string | null
  salePrice: number
  paymentType: string
  customerName?: string | null
}

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`

const paymentLabel = (t: string) =>
  ({ cash: 'Cash', bank_transfer: 'Bank Transfer', udhaar: 'Udhaar' } as Record<string, string>)[t] ?? t.replace(/_/g, ' ')

export async function downloadReceipt(data: ReceiptData): Promise<void> {
  const { pdf } = await import('@react-pdf/renderer')
  const React = await import('react')
  const { Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')

  const styles = StyleSheet.create({
    page: { padding: 36, fontFamily: 'Helvetica', fontSize: 11 },
    shopName: { fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
    sub: { fontSize: 10, color: '#666', marginBottom: 22 },
    sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 8, color: '#333', textTransform: 'uppercase' },
    section: { marginBottom: 18 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
    label: { color: '#555' },
    value: { fontWeight: 'bold' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, marginTop: 4, borderTopWidth: 2, borderTopColor: '#333' },
    totalLabel: { fontSize: 13, fontWeight: 'bold' },
    totalValue: { fontSize: 15, fontWeight: 'bold' },
    footer: { marginTop: 30, textAlign: 'center', color: '#666', fontSize: 10 },
  })

  const soldDate = new Date(data.soldAt)
  const dateStr = soldDate.toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = soldDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
  const specsLine = [data.processor, data.ram, data.storage].filter(Boolean).join(' · ')

  const rows: [string, string][] = [
    ['Laptop', `${data.brand} ${data.model}`],
    ...(specsLine ? [['Specs', specsLine] as [string, string]] : []),
    ['Serial Number', data.imei ?? 'No serial'],
    ['Payment Type', paymentLabel(data.paymentType)],
    ...(data.customerName ? [['Customer', data.customerName] as [string, string]] : []),
  ]

  const doc = React.default.createElement(
    Document,
    null,
    React.default.createElement(
      Page,
      { size: 'A5', style: styles.page },
      React.default.createElement(Text, { style: styles.shopName }, data.shopName),
      React.default.createElement(Text, { style: styles.sub }, `Sale Receipt · ${dateStr} at ${timeStr}`),
      React.default.createElement(
        View,
        { style: styles.section },
        ...rows.map(([label, value]) =>
          React.default.createElement(
            View,
            { key: label, style: styles.row },
            React.default.createElement(Text, { style: styles.label }, label),
            React.default.createElement(Text, { style: styles.value }, value)
          )
        )
      ),
      React.default.createElement(
        View,
        { style: styles.totalRow },
        React.default.createElement(Text, { style: styles.totalLabel }, 'Total'),
        React.default.createElement(Text, { style: styles.totalValue }, fmtRs(data.salePrice))
      ),
      React.default.createElement(
        Text,
        { style: styles.footer },
        `Thank you for your purchase!${data.whatsappNumber ? `\nWhatsApp: ${data.whatsappNumber}` : ''}`
      )
    )
  )

  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `receipt-${data.brand}-${data.model}-${soldDate.toISOString().slice(0, 10)}.pdf`.replace(/\s+/g, '-')
  a.click()
  URL.revokeObjectURL(url)
}
