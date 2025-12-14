import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Cho phép Vite truy cập vào thư mục cấp cao hơn (để đọc folder shared)
      allow: ['..'] 
    }
  },
  resolve: {
    alias: {
      // Tạo đường dẫn tắt '@shared' để import cho gọn
      '@shared': path.resolve(__dirname, '../shared/src') 
    }
  }
})