import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { StaffRoute } from './components/StaffRoute'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { WelcomePage } from './pages/WelcomePage'
import { WorkOrderDetailPage } from './pages/WorkOrderDetailPage'
import { WorkOrderFormPage } from './pages/WorkOrderFormPage'
import { WorkOrderListPage } from './pages/WorkOrderListPage'

// The router (BrowserRouter) is added in main.tsx so tests can use MemoryRouter instead.
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<WorkOrderListPage />} />
            <Route path="/account" element={<WelcomePage />} />
            <Route path="/workorders/:id" element={<WorkOrderDetailPage />} />
            <Route element={<StaffRoute />}>
              <Route path="/workorders/new" element={<WorkOrderFormPage />} />
              <Route path="/workorders/:id/edit" element={<WorkOrderFormPage />} />
            </Route>
          </Route>
          <Route path="*" element={<p>Page not found.</p>} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
