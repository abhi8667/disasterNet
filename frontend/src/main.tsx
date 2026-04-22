import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { MeshProvider } from './context/MeshContext.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MeshProvider>
      <App />
    </MeshProvider>
  </React.StrictMode>,
)
