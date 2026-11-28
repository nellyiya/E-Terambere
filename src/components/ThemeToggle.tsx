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
  // Switch is ON (brand teal) in light mode, to match the "Light Mode" label in the sidebar.
  const light = !dark
  return (
    <button
      type="button"
      role="switch"
      aria-checked={light}
      onClick={toggle}
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
      title={light ? 'Light mode' : 'Dark mode'}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-2 focus:outline-offset-2 focus:outline-slate-950 ${light ? 'bg-brand' : 'bg-slate-300'}`}
    >
      <span className={`absolute left-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-transform duration-200 ${light ? 'translate-x-5' : 'translate-x-0'}`}>
        {light ? <Sun size={12} className="text-brand" /> : <Moon size={12} className="text-slate-500" />}
      </span>
    </button>
  )
}
