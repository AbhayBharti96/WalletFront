// ─── themeSlice.ts ────────────────────────────────────────────────────────────
import { createSlice } from '@reduxjs/toolkit'

const saved = localStorage.getItem('theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const isDark = saved ? saved === 'dark' : prefersDark
if (isDark) document.documentElement.classList.add('dark')

const themeSlice = createSlice({
  name: 'theme',
  initialState: { isDark },
  reducers: {
    toggleTheme(state) {
      state.isDark = !state.isDark
      document.documentElement.classList.toggle('dark', state.isDark)
      localStorage.setItem('theme', state.isDark ? 'dark' : 'light')
    },
  },
})
export const { toggleTheme } = themeSlice.actions
export default themeSlice.reducer
