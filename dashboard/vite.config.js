import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// DEMO_PASSWORD (in .env.local, no VITE_ prefix on purpose) powers the dev-only sample sign-in buttons. It is
// only ever defined for `vite` dev; a production build gets an empty string, so the password can't ship.
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  define: { __DEMO_PASSWORD__: JSON.stringify(command === 'serve' ? (loadEnv(mode, process.cwd(), '').DEMO_PASSWORD ?? '') : '') },
}))
