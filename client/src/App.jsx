import { QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { queryClient } from './api/queryClient.js';
import { AuthProvider } from './features/auth/AuthProvider.jsx';
import { GuestRoute, ProtectedRoute } from './features/auth/routeGuards.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';
import LoginPage from './features/auth/pages/LoginPage.jsx';
import RegisterPage from './features/auth/pages/RegisterPage.jsx';
import LibraryPage from './features/documents/pages/LibraryPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import RouteErrorPage from './pages/RouteErrorPage.jsx';

// Loads a page module on first navigation. react-markdown and the chat code stay out of the initial bundle.
const page = (load) => async () => ({ Component: (await load()).default });

const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <GuestRoute />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/',
            element: <AppLayout />,
            children: [
              { index: true, element: <LibraryPage /> },
              {
                path: 'documents/:id',
                lazy: page(() => import('./features/documents/pages/DocumentPage.jsx')),
              },
              { path: 'chat', lazy: page(() => import('./features/chat/pages/ChatIndexPage.jsx')) },
              {
                path: 'chat/:id',
                lazy: page(() => import('./features/chat/pages/ConversationPage.jsx')),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
