import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { CiphPlugin } from '@ciph/vue'

const app = createApp(App)

app.use(CiphPlugin, {
  baseURL: import.meta.env.VITE_API_URL as string ?? 'http://localhost:4008',
  serverPublicKey: import.meta.env.CIPH_PUBLIC_KEY as string ?? '',
  devtools: {
    defaultOpen: true,
    position: 'bottom',
  },
})

app.mount('#app')
