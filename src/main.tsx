import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootstrap } from './lib/bootstrap'

const root = createRoot(document.getElementById('root')!)
async function start() {
  try {
    const runtime = await bootstrap()
    root.render(<StrictMode><App {...runtime} /></StrictMode>)
  } catch (error) {
    root.render(<main className="welcome" role="alert"><h1>Workspace setup failed</h1><p>{error instanceof Error ? error.message : 'Please check the application configuration.'}</p><button type="button" onClick={() => window.location.reload()}>Reload</button></main>)
  }
}
void start()
