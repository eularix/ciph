import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { CiphProvider } from '@ciph/react'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CiphProvider
      baseURL={import.meta.env.VITE_API_URL as string}
      serverPublicKey={import.meta.env.VITE_CIPH_SERVER_PUBLIC_KEY as string}
    >
      <App />
      {/* 🛡️ Ciph Inspector panel auto-renders in development — no extra imports needed */}
    </CiphProvider>
  </StrictMode>
)
