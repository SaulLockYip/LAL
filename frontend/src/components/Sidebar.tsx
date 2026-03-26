import { Link, useLocation } from 'react-router-dom'
import { BookOpen, List, PenTool, Settings, Sun, Moon, Volume2 } from 'lucide-react'
import { useTheme } from './ThemeProvider'

const navItems = [
  { path: '/articles', label: 'Articles', icon: BookOpen },
  { path: '/word-list', label: 'Word List', icon: List },
  { path: '/exercises', label: 'Exercises', icon: PenTool },
  { path: '/tts', label: 'TTS', icon: Volume2 },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold">LAL</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Learn Any Language</p>
      </div>

      <nav className="flex-1 px-4">
        <ul className="space-y-2">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path
            return (
              <li key={path}>
                <Link
                  to={path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
      </div>
    </aside>
  )
}
