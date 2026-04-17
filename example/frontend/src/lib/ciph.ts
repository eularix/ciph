import { createClient } from '@ciph/client'

export const ciph = createClient({
  baseURL: 'http://localhost:4008', // backend example port
  secret: '266117083498be6f5cfc0f086a560456ec435ce6c7079b5d7a4d62f2d9eb2f3b',
  fingerprintOptions: {
    includeScreen: true,
    includeTimezone: true,
  }
})

