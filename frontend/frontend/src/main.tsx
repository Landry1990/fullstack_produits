import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './config/axios' // Axios interceptors pour gérer 401 automatiquement
import './i18n'
import App from './App.tsx'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
