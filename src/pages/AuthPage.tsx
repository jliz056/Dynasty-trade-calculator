import { FormEvent, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function friendlyError(code: string): string {
  if (code.includes('invalid-credential') || code.includes('wrong-password'))
    return 'Incorrect email or password.';
  if (code.includes('user-not-found')) return 'No account found with that email.';
  if (code.includes('email-already-in-use')) return 'An account with that email already exists.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('invalid-email')) return 'Please enter a valid email address.';
  return 'Something went wrong. Please try again.';
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Stack spacing={3}>
          <Stack alignItems="center" spacing={1}>
            <SportsFootballIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant="h5">Welcome</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Sign in to save trades and access them anywhere
            </Typography>
          </Stack>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
            <Tab label="Sign in" value="login" />
            <Tab label="Create account" value="register" />
          </Tabs>

          {error && <Alert severity="error">{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                required
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" variant="contained" size="large" disabled={busy}>
                {busy ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Box>
  );
}
