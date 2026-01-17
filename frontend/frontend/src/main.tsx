import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './config/axios' // Axios interceptors pour gérer 401 automatiquement
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
