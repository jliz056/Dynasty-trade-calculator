import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import LogoutIcon from '@mui/icons-material/Logout';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Calculator' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/draft', label: 'Draft' },
  { to: '/leagues', label: 'My Leagues' },
  { to: '/history', label: 'My Trades' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'rgba(11, 17, 32, 0.85)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 1 }}>
          <SportsFootballIcon sx={{ color: 'primary.main', mr: 1 }} />
          <Typography
            variant="h6"
            component={Link}
            to="/"
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              fontWeight: 800,
              mr: 3,
              display: { xs: 'none', sm: 'block' },
            }}
          >
            Dynasty Trade Calculator
          </Typography>

          <Box sx={{ display: 'flex', gap: 0.5, flexGrow: 1 }}>
            {NAV_LINKS.map((link) => (
              <Button
                key={link.to}
                component={Link}
                to={link.to}
                sx={{
                  color: location.pathname === link.to ? 'primary.main' : 'text.secondary',
                  fontWeight: location.pathname === link.to ? 700 : 500,
                }}
              >
                {link.label}
              </Button>
            ))}
          </Box>

          {user ? (
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              sx={{ color: 'text.secondary' }}
            >
              Sign out
            </Button>
          ) : (
            <Button variant="outlined" component={Link} to="/login">
              Sign in
            </Button>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}
