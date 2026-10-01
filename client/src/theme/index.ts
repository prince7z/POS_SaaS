import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'
import { tokens } from './tokens'
import { typography } from './typography'

const config = defineConfig({
  theme: {
    tokens: {
      colors: tokens.colors,
      spacing: tokens.spacing,
      radii: tokens.radii,
      fonts: typography.fonts,
    },
    textStyles: typography.textStyles,
    breakpoints: {
      sm: '30em',
      md: '48em',
      lg: '64em',
      xl: '80em',
    },
  },
  globalCss: {
    'html, body': {
      background: 'background',
      color: 'foreground',
      fontFamily: 'body',
      fontSize: '14px',
    },
    '*': { borderColor: 'border' },
  },
})

export const system = createSystem(defaultConfig, config)
