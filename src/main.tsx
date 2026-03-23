import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import './index.css'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="h-full min-h-0">
      <RouterProvider router={router} />
    </div>
    <Toaster
      richColors
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'rounded-xl border border-zinc-200/80 bg-white/95 shadow-lg backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95',
          title: 'text-zinc-900 dark:text-zinc-100',
          description: 'text-zinc-500 dark:text-zinc-300',
        },
      }}
    />
  </StrictMode>,
)
