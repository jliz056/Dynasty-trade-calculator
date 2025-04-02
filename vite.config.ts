import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {
      REACT_APP_COLLEGE_FOOTBALL_API_KEY: JSON.stringify(process.env.REACT_APP_COLLEGE_FOOTBALL_API_KEY),
      REACT_APP_COLLEGE_FOOTBALL_API_URL: JSON.stringify(process.env.REACT_APP_COLLEGE_FOOTBALL_API_URL),
      REACT_APP_SLEEPER_API_URL: JSON.stringify(process.env.REACT_APP_SLEEPER_API_URL)
    }
  }
}) 