import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoadingOverlay } from '@mantine/core';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/admin/ProductsPage';
import PricingPage from './pages/admin/PricingPage';
import UsersPage from './pages/admin/UsersPage';
import PanelsPage from './pages/admin/PanelsPage';
import ComponentsPage from './pages/admin/ComponentsPage';
import RulesPage from './pages/admin/RulesPage';
import QuotesListPage from './pages/quotes/QuotesListPage';
import QuoteWizardPage from './pages/quotes/QuoteWizardPage';
import QuoteDetailPage from './pages/quotes/QuoteDetailPage';
import SystemDesignerPage from './pages/quotes/SystemDesignerPage';
import BracketCalculatorPage from './pages/tools/BracketCalculatorPage';
import AppShell from './components/layout/AppShell';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingOverlay visible />;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/quotes" element={<QuotesListPage />} />
                <Route path="/quotes/new" element={<QuoteWizardPage />} />
                <Route path="/quotes/design/new" element={<SystemDesignerPage />} />
                <Route path="/quotes/:id" element={<QuoteDetailPage />} />
                <Route path="/quotes/:id/edit" element={<QuoteWizardPage />} />
                <Route path="/quotes/:id/design" element={<SystemDesignerPage />} />
                <Route path="/tools/bracket-calculator" element={<BracketCalculatorPage />} />
                <Route path="/admin/products" element={<AdminRoute><ProductsPage /></AdminRoute>} />
                <Route path="/admin/panels" element={<AdminRoute><PanelsPage /></AdminRoute>} />
                <Route path="/admin/components" element={<AdminRoute><ComponentsPage /></AdminRoute>} />
                <Route path="/admin/rules" element={<AdminRoute><RulesPage /></AdminRoute>} />
                <Route path="/admin/pricing" element={<AdminRoute><PricingPage /></AdminRoute>} />
                <Route path="/admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
