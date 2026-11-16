import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base 設成相對路徑，部署到 GitHub Pages 子路徑也能正常載入
export default defineConfig({
  plugins: [react()],
  base: './',
})
