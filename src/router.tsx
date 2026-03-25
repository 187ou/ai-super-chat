/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { getSettings } from './lib/storage'
import { AppLayout } from './components/layout/AppLayout'
import { RoutePageFallback } from './components/common/RoutePageFallback'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const ContentProductionPage = lazy(() => import('./pages/ContentProductionPage'))
const CodeGenPage = lazy(() => import('./pages/CodeGenPage'))
const ApiDocPage = lazy(() => import('./pages/ApiDocPage'))
const ChartsPage = lazy(() => import('./pages/ChartsPage'))
const DebugPage = lazy(() => import('./pages/DebugPage'))
const EditorPage = lazy(() => import('./pages/EditorPage'))
const MultimodalPage = lazy(() => import('./pages/MultimodalPage'))
const RagPage = lazy(() => import('./pages/RagPage'))
const IntelligentAnalysisPage = lazy(() => import('./pages/IntelligentAnalysisPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const RouteErrorPage = lazy(() => import('./pages/RouteErrorPage'))

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<RoutePageFallback />}>{node}</Suspense>
}

function Guard({ children }: { children: ReactNode }) {
  const settings = getSettings()
  if (settings.authRequired) {
    const passed = localStorage.getItem('ai_dev_assistant_passed') === '1'
    if (!passed) return <Navigate to="/profile" replace />
  }
  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: withSuspense(<RouteErrorPage />),
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },
      { path: 'chat', element: withSuspense(<Guard><ChatPage /></Guard>) },
      { path: 'content-production', element: withSuspense(<Guard><ContentProductionPage /></Guard>) },
      { path: 'codegen', element: withSuspense(<Guard><CodeGenPage /></Guard>) },
      { path: 'apidoc', element: withSuspense(<Guard><ApiDocPage /></Guard>) },
      { path: 'charts', element: withSuspense(<Guard><ChartsPage /></Guard>) },
      { path: 'debug', element: withSuspense(<Guard><DebugPage /></Guard>) },
      { path: 'editor', element: withSuspense(<Guard><EditorPage /></Guard>) },
      { path: 'multimodal', element: withSuspense(<Guard><MultimodalPage /></Guard>) },
      { path: 'rag', element: withSuspense(<Guard><RagPage /></Guard>) },
      { path: 'intelligent-analysis', element: withSuspense(<Guard><IntelligentAnalysisPage /></Guard>) },
      { path: 'profile', element: withSuspense(<ProfilePage />) },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
])
