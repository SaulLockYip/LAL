import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { ArticlesPage } from './pages/ArticlesPage'
import { ArticleDetailPage } from './pages/ArticleDetailPage'
import { WordListPage } from './pages/WordListPage'
import { ExercisesPage } from './pages/ExercisesPage'
import { SettingsPage } from './pages/SettingsPage'
import { TTSPage } from './pages/TTSPage'
import { ChatBox } from './components/ChatBox'

function App() {
  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Sidebar />
      <main className="flex-1 ml-64">
        <Routes>
          <Route path="/" element={<Navigate to="/articles" replace />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/articles/:id" element={<ArticleDetailPage />} />
          <Route path="/word-list" element={<WordListPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/tts" element={<TTSPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <ChatBox />
    </div>
  )
}

export default App
