import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// The markup is already in the HTML: scripts/prerender.mjs bakes it in at
// build time so crawlers get the whole page without running anything.
// Hydrate onto it rather than throwing it away. The dev server has no baked
// markup, so fall back to a plain render there.
const root = document.getElementById('root')
// a player page carries its records file in the HTML, so the hydrate matches the prerender
const data = document.getElementById('player-data')
let preload = null
try { preload = data ? JSON.parse(data.textContent) : null } catch {}
const app = (
  <React.StrictMode>
    <App path={window.location.pathname} preload={preload} />
  </React.StrictMode>
)
if (root.firstChild) hydrateRoot(root, app)
else createRoot(root).render(app)
