export const typography = {
  fonts: {
    body: { value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
    heading: { value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  },
  textStyles: {
    body: { value: { fontSize: '14px', lineHeight: '1.5' } },
    supporting: { value: { fontSize: '13px', lineHeight: '1.45' } },
    label: { value: { fontSize: '12px', lineHeight: '1.35', fontWeight: '600' } },
    pageTitle: { value: { fontSize: '26px', lineHeight: '1.2', fontWeight: '700' } },
  },
} as const

export const fontFamily = typography.fonts
export const fontSize = { xs: '12px', sm: '13px', md: '14px', lg: '16px', xl: '18px', '2xl': '22px', '3xl': '28px' } as const
export const fontWeight = { normal: 400, medium: 500, semibold: 600, bold: 700 } as const
export const lineHeight = { normal: 1.5, tight: 1.2 } as const
