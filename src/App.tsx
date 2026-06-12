import { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress, Container, CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import Navbar from './components/Navbar';
import Calculator from './pages/Calculator';
import Rankings from './pages/Rankings';
import Draft from './pages/Draft';
import Leagues from './pages/Leagues';
import History from './pages/History';
import AuthPage from './pages/AuthPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Navbar />
            <Container maxWidth="lg" sx={{ pb: 8 }}>
              <Routes>
                <Route path="/" element={<Calculator />} />
                <Route path="/rankings" element={<Rankings />} />
                <Route path="/draft" element={<Draft />} />
                <Route path="/leagues" element={<Leagues />} />
                <Route
                  path="/history"
                  element={
                    <RequireAuth>
                      <History />
                    </RequireAuth>
                  }
                />
                <Route path="/login" element={<AuthPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Container>
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
