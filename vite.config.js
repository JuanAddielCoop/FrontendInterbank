import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const ensureLeadingSlash = (value) => {
  if (!value) return ''
  return value.startsWith('/') ? value : `/${value}`
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeTarget = (value) => {
  if (!value) return ''
  return value.endsWith('/') ? value.slice(0, -1) : value
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyPath = ensureLeadingSlash(env.VITE_AUTH_PROXY_PATH ?? '')
  const proxyTarget = normalizeTarget(
    env.VITE_AUTH_API_URL ?? env.VITE_BASE_API_URL ?? 'https://localhost:7137',
  )

  const hasProxy = Boolean(proxyPath && proxyTarget)
  const rewritePattern = hasProxy ? new RegExp(`^${escapeRegex(proxyPath)}`) : null

  return {
    plugins: [react()],
    server: hasProxy
      ? {
          proxy: {
            [proxyPath]: {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(rewritePattern, ''),
            },
          },
        }
      : undefined,
  }
})
