import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AdminGate } from './components/AdminGate'
import { EnrollmentForm } from './components/EnrollmentForm'

const router = createHashRouter([
  {
    path: '/',
    element: <EnrollmentForm />,
  },
  {
    path: '/admin',
    element: <AdminGate />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
