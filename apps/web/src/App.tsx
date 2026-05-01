import React, { useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';
import { InvitePage } from './pages/InvitePage';
import { PrivacyPage } from './pages/PrivacyPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ProfileSharePage } from './pages/ProfileSharePage';
import { MiningPage } from './pages/MiningPage';
import { DevelopersPage } from './pages/DevelopersPage';
import { InfoPage } from './pages/InfoPage';
import { DonatePage } from './pages/DonatePage';
import { TermsPage } from './pages/TermsPage';
import { CookiesPage } from './pages/CookiesPage';
import { MusicBotInstructionsPage } from './pages/MusicBotInstructionsPage';
import { MusicBotPrivacyPage } from './pages/MusicBotPrivacyPage';
import { InstallPrompt } from './components/pwa/InstallPrompt';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { isAuthenticated, fetchMe } = useAuthStore();

  // Solana wallet setup
  const endpoint = useMemo(() => clusterApiUrl('devnet'), []);
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMe();
    }
  }, [isAuthenticated, fetchMe]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/invite/:code" element={<InvitePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/roadmap" element={<RoadmapPage />} />
              <Route path="/developers" element={<DevelopersPage />} />
              <Route path="/docs" element={<DevelopersPage />} />
              <Route path="/info" element={<InfoPage />} />
              <Route path="/donate" element={<DonatePage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/cookies" element={<CookiesPage />} />
              <Route path="/bots/music/instructions" element={<MusicBotInstructionsPage />} />
              <Route path="/bots/music/privacy" element={<MusicBotPrivacyPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/mining" element={<MiningPage />} />
              {/* Universal share-link landing for any user/bot username.
                  Reserved system paths above match first; anything else falls
                  through here and gets resolved by GET /api/v1/u/:username. */}
              <Route path="/:username" element={<ProfileSharePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'dark:bg-dark-600 dark:text-white',
            }}
          />
          <InstallPrompt />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
