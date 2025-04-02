import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  ListItemIcon,
} from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import CalculateIcon from '@mui/icons-material/Calculate';
import HistoryIcon from '@mui/icons-material/History';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import { logout } from '../services/auth';

interface NavbarProps {
  user: User;
}

const Navbar = ({ user }: NavbarProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  
  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const navigationItems = [
    { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
    { to: '/calculator', label: 'Calculator', icon: <CalculateIcon /> },
    { to: '/rankings', label: 'Rankings', icon: <FormatListNumberedIcon /> },
    { to: '/history', label: 'History', icon: <HistoryIcon /> },
  ];

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography 
          variant="h6" 
          component={Link} 
          to="/"
          sx={{ 
            flexGrow: 1, 
            textDecoration: 'none', 
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <CalculateIcon />
          Dynasty Trade Calculator
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {navigationItems.map((item) => (
            <Button 
              key={item.to}
              color="inherit" 
              component={Link} 
              to={item.to}
              startIcon={item.icon}
              sx={{ mr: 1 }}
            >
              {item.label}
            </Button>
          ))}
          
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
            <Avatar 
              sx={{ width: 32, height: 32, bgcolor: 'primary.dark' }}
              alt={user.displayName || user.email || 'User'}
              src={user.photoURL || undefined}
            >
              {(user.displayName || user.email || 'U')[0].toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem sx={{ pointerEvents: 'none' }}>
              <Typography variant="body2">
                {user.displayName || user.email}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { handleClose(); navigate('/profile'); }}>
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <ExitToAppIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar; 