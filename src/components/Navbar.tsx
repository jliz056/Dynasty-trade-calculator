import { useState } from 'react';
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import CalculateIcon from '@mui/icons-material/Calculate';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import InsightsIcon from '@mui/icons-material/Insights';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ScienceIcon from '@mui/icons-material/Science';
import GroupsIcon from '@mui/icons-material/Groups';
import HistoryIcon from '@mui/icons-material/History';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import LoginIcon from '@mui/icons-material/Login';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Calculator', icon: <CalculateIcon /> },
  { to: '/rankings', label: 'Rankings', icon: <LeaderboardIcon /> },
  { to: '/draft', label: 'Draft', icon: <HowToVoteIcon /> },
  { to: '/leagues', label: 'My Leagues', icon: <GroupsIcon /> },
  { to: '/lab', label: 'ML Lab', icon: <ScienceIcon /> },
  { to: '/model', label: 'Model', icon: <InsightsIcon /> },
  { to: '/history', label: 'My Trades', icon: <HistoryIcon /> },
];

const BOTTOM_TABS = [
  { to: '/', label: 'Trade', icon: <CalculateIcon /> },
  { to: '/rankings', label: 'Ranks', icon: <LeaderboardIcon /> },
  { to: '/model', label: 'Model', icon: <InsightsIcon /> },
];

function bottomValue(pathname: string): string {
  if (BOTTOM_TABS.some((t) => t.to === pathname)) return pathname;
  return 'more';
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = () => setDrawerOpen(false);

  const drawer = (
    <Box sx={{ width: 280, pt: 1 }} role="presentation">
      <Typography variant="subtitle2" sx={{ px: 2, py: 1.5, color: 'text.secondary' }}>
        Menu
      </Typography>
      <List>
        {NAV_LINKS.map((link) => (
          <ListItemButton
            key={link.to}
            component={Link}
            to={link.to}
            selected={location.pathname === link.to}
            onClick={closeDrawer}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>{link.icon}</ListItemIcon>
            <ListItemText primary={link.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <List>
        {user ? (
          <ListItemButton
            onClick={async () => {
              closeDrawer();
              await logout();
              navigate('/');
            }}
          >
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Sign out" />
          </ListItemButton>
        ) : (
          <ListItemButton component={Link} to="/login" onClick={closeDrawer}>
            <ListItemIcon>
              <LoginIcon />
            </ListItemIcon>
            <ListItemText primary="Sign in" />
          </ListItemButton>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(11, 17, 32, 0.92)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{ display: { md: 'none' } }}
              aria-label="Open menu"
            >
              <MenuIcon />
            </IconButton>

            <SportsFootballIcon sx={{ color: 'primary.main' }} />
            <Typography
              variant="h6"
              component={Link}
              to="/"
              sx={{
                textDecoration: 'none',
                color: 'inherit',
                fontWeight: 800,
                fontSize: { xs: '1rem', sm: '1.25rem' },
                mr: { md: 3 },
                flexGrow: { xs: 1, md: 0 },
              }}
            >
              Dynasty
            </Typography>

            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, flexGrow: 1 }}>
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

            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
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
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={closeDrawer}
        ModalProps={{ keepMounted: true }}
      >
        {drawer}
      </Drawer>

      <BottomNavigation
        showLabels
        value={bottomValue(location.pathname)}
        onChange={(_, value: string) => {
          if (value === 'more') {
            setDrawerOpen(true);
            return;
          }
          navigate(value);
        }}
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          borderTop: '1px solid rgba(148, 163, 184, 0.12)',
          bgcolor: 'rgba(11, 17, 32, 0.96)',
          backdropFilter: 'blur(8px)',
          pb: 'env(safe-area-inset-bottom)',
          height: 'auto',
          minHeight: 56,
        }}
      >
        {BOTTOM_TABS.map((tab) => (
          <BottomNavigationAction
            key={tab.to}
            value={tab.to}
            label={tab.label}
            icon={tab.icon}
          />
        ))}
        <BottomNavigationAction value="more" label="More" icon={<MoreHorizIcon />} />
      </BottomNavigation>
    </>
  );
}
