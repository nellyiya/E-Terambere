import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
export default function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('worksync.theme', next ? 'dark' : 'light') } catch { /* preference just won't persist */ }
    setDark(next)
  }
  return <button onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'} className="rounded p-2 hover:bg-slate-100">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
}
