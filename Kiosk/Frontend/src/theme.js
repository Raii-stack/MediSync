import { createSystem, defaultSystem } from '@chakra-ui/react';

const system = createSystem(defaultSystem, {
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#e8f3ff' },
          100: { value: '#c6dcff' },
          200: { value: '#9ec1ff' },
          300: { value: '#73a4ff' },
          400: { value: '#4c8aff' },
          500: { value: '#2f72f5' },
          600: { value: '#1f5ad4' },
          700: { value: '#1646a7' },
          800: { value: '#10347a' },
          900: { value: '#0b2352' }
        }
      }
    }
  },
  globalCss: {
    body: {
      bg: 'gray.50',
      overflow: 'hidden'
    }
  }
});

export default system;
