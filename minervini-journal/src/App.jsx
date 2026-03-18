import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/ui/Toast';
import { TradeModalProvider, useTradeModal } from './context/TradeModalContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Watchlist from './pages/Watchlist';
import StockDetail from './pages/StockDetail';
import Strategies from './pages/Strategies';
import Stats from './pages/Stats';
import Sepa from './pages/Sepa';
import Sidebar from './components/layout/Sidebar';
import PortfolioSetupModal from './components/portfolio/PortfolioSetupModal';
import SmartTradeModal from './components/SmartTradeModal';
import { loadData, saveData, loadWatchlist } from './utils/storage';
import { defaultSettings } from './utils/portfolioUtils';

function LayoutInner({ children, user, setUser, logout }) {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const username = user?.username || '';
  const settings = username ? (loadData(username, 'settings', defaultSettings()) || defaultSettings()) : defaultSettings();
  const hasPortfolio = (settings.portfolioSize != null && settings.portfolioSize > 0) || (user?.portfolioSize != null && user.portfolioSize > 0);
  const showSetup = user && !hasPortfolio;
  const { open: tradeModalOpen, closeModal: closeTradeModal } = useTradeModal();

  const handleSetupSave = (payload) => {
    const current = loadData(username, 'settings', defaultSettings()) || defaultSettings();
    saveData(username, 'settings', { ...defaultSettings(), ...current, ...payload });
    setUser({ ...user, portfolioSize: payload.portfolioSize });
  };

  const handleSmartTradeSave = (newStock) => {
    const list = loadWatchlist(username);
    saveData(username, 'watchlist', [...list, newStock]);
    closeTradeModal();
  };

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar user={user} setUser={setUser} logout={logout} />
      <main className="flex-1 pb-20 md:pb-0 md:mr-[220px]">{children}</main>
      {showSetup && (
        <PortfolioSetupModal onSave={handleSetupSave} />
      )}
      <SmartTradeModal
        open={tradeModalOpen}
        onClose={closeTradeModal}
        username={username}
        settings={settings}
        onSave={handleSmartTradeSave}
      />
    </div>
  );
}

function Layout(props) {
  return (
    <TradeModalProvider>
      <LayoutInner {...props} />
    </TradeModalProvider>
  );
}

const ProtectedRoute = ({ children, user }) =>
  user ? children : <Navigate to="/login" replace />;

export default function App() {
  const { user, setUser, logout, loading } = useAuth();
  if (loading) return null;

  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> 
               : <Login setUser={setUser} />
        } />
        <Route path="/*" element={
          <ProtectedRoute user={user}>
            <Layout user={user} setUser={setUser} logout={logout}>
              <Routes>
                <Route path="/dashboard" element={<Dashboard user={user} setUser={setUser} />} />
                <Route path="/watchlist" element={<Watchlist user={user} />} />
                <Route path="/stock/:id" element={<StockDetail user={user} />} />
                <Route path="/strategies" element={<Strategies user={user} />} />
                <Route path="/stats" element={<Stats user={user} />} />
                <Route path="/sepa" element={<Sepa user={user} />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}
