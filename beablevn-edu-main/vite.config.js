import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'BE ABLE VN EDUCATION',
        short_name: 'BAVN EDU',
        description: 'Hệ thống quản lý đào tạo Be Able VN',
        theme_color: '#003366',      // Màu thanh trạng thái (xanh dương đậm)
        background_color: '#003366', // Màu nền màn hình chờ (xanh dương đậm)
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/BA LOGO.png',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/png'
          },
          {
            src: '/BA LOGO.png',
            type: 'image/png',
            sizes: '192x192'
          },
          {
            src: '/BA LOGO.png',
            type: 'image/png',
            sizes: '512x512'
          },
        ]
      }
    })
  ],
})