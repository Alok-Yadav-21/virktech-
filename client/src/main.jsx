import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/theme.css'
import './styles/app.css'
import { CartProvider } from './context/CartContext.jsx'
import { VapeCartProvider } from './context/VapeCartContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { BranchProvider } from './context/BranchContext.jsx'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <CartProvider>
        <BranchProvider>
          <VapeCartProvider>
            <App />
          </VapeCartProvider>
        </BranchProvider>
      </CartProvider>
    </AuthProvider>
    <Toaster
      position="bottom-center" containerClassName="vt-toaster"
      toastOptions={{ duration: 3000, style: { borderRadius: '999px', background: '#091a11', color: '#fff', padding: '0.7rem 1.1rem', fontWeight: 600, maxWidth: '92vw' } }}
    />
  </BrowserRouter>,
)
