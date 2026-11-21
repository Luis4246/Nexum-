import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/pages.css'
import { ToastProvider } from './components/Toast'
import App from './App'

createRoot(document.getElementById('root')).render(<ToastProvider><App /></ToastProvider>)
