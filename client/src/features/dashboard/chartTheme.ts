import { chartColors } from '@/theme/tokens'

export function getChartThemeTokens() {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback

  return {
    primary: read('--chakra-colors-primary', chartColors[0]),
    secondary: read('--chakra-colors-info', chartColors[1]),
    success: read('--chakra-colors-success', chartColors[2]),
    border: read('--chakra-colors-border', '#E5E7EB'),
    text: read('--chakra-colors-secondary', '#6B7280'),
    surface: read('--chakra-colors-surface', '#FFFFFF'),
    foreground: read('--chakra-colors-foreground', '#111827'),
    categories: chartColors,
  }
}
