import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Tabs,
  Tab,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Chip,
  Grid,
  Divider,
  Avatar,
  DialogActions,
  Button,
  Alert,
  LinearProgress,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Collapse,
  Stack
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { getPlayerById, PlayerData } from '../services/player';
import { getPlayerSleeperStats, getPlayerStats } from '../services/sleeper';
import { fetchPlayerStats } from '../services/nflApi';
import { Player } from '../types/player';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`player-tabpanel-${index}`}
      aria-labelledby={`player-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Mock data for week-by-week stats
const weeklyStats = [
  { week: 1, opponent: 'KC', result: 'W 24-20', targets: 9, receptions: 6, yards: 92, td: 1, fantasy_points: 21.2 },
  { week: 2, opponent: 'BUF', result: 'L 17-24', targets: 12, receptions: 8, yards: 112, td: 0, fantasy_points: 19.2 },
  { week: 3, opponent: 'CIN', result: 'W 28-21', targets: 7, receptions: 5, yards: 67, td: 1, fantasy_points: 17.7 },
  { week: 4, opponent: 'PIT', result: 'W 31-14', targets: 10, receptions: 7, yards: 85, td: 2, fantasy_points: 27.5 },
  { week: 5, opponent: 'BAL', result: 'L 20-23', targets: 11, receptions: 6, yards: 76, td: 0, fantasy_points: 13.6 },
];

// Mock data for career stats
const careerStats = [
  { season: '2020', team: 'MIN', games: 16, targets: 125, receptions: 88, yards: 1400, td: 7, fantasy_points: 287 },
  { season: '2021', team: 'MIN', games: 17, targets: 167, receptions: 108, yards: 1616, td: 10, fantasy_points: 322 },
  { season: '2022', team: 'MIN', games: 10, targets: 106, receptions: 76, yards: 1074, td: 8, fantasy_points: 234 },
  { season: '2023', team: 'MIN', games: 17, targets: 174, receptions: 128, yards: 1809, td: 9, fantasy_points: 344 },
  { season: '2024', team: 'MIN', games: 5, targets: 49, receptions: 32, yards: 432, td: 4, fantasy_points: 99 },
];

// Mock data for fantasy league history
const fantasyHistory = [
  { season: '2020', league: 'Dynasty Heroes', manager: 'John Smith', finish: '3rd Place', ppg: 18.8 },
  { season: '2021', league: 'Dynasty Heroes', manager: 'John Smith', finish: 'Champion', ppg: 20.1 },
  { season: '2022', league: 'Dynasty Heroes', manager: 'John Smith', finish: '5th Place', ppg: 21.4 },
  { season: '2023', league: 'Dynasty Heroes', manager: 'Alex Johnson', finish: 'Runner-up', ppg: 19.7 },
];

// Mock data for depth chart
const depthChart = [
  { position: 'WR1', name: 'Justin Jefferson', notes: 'Starter, plays 95% of snaps' },
  { position: 'WR2', name: 'Jordan Addison', notes: 'Starter, plays 80% of snaps' },
  { position: 'WR3', name: 'K.J. Osborn', notes: 'Rotational, plays 45% of snaps' },
  { position: 'TE1', name: 'T.J. Hockenson', notes: 'Starter, plays 85% of snaps' },
  { position: 'QB1', name: 'Sam Darnold', notes: 'Starter' },
  { position: 'RB1', name: 'Aaron Jones', notes: 'Starter, plays 60% of snaps' },
];

// Mock data for NCAA stats
const ncaaStats = [
  { season: '2022', school: 'Ohio State', games: 13, comp: 258, att: 389, yards: 3682, td: 41, int: 6, rushYards: 374, rushTD: 5 },
  { season: '2021', school: 'Ohio State', games: 13, comp: 287, att: 395, yards: 4435, td: 44, int: 6, rushYards: 256, rushTD: 3 },
  { season: '2020', school: 'Ohio State', games: 8, comp: 165, att: 225, yards: 2103, td: 22, int: 6, rushYards: 383, rushTD: 5 },
];

interface PlayerDetailsProps {
  open: boolean;
  onClose: () => void;
  playerId?: string;
}

const getPositionColor = (position: string) => {
  switch (position) {
    case 'QB':
      return 'primary';
    case 'RB':
      return 'secondary';
    case 'WR':
      return 'success';
    case 'TE':
      return 'warning';
    default:
      return 'info';
  }
};

const formatStat = (value: number | undefined, isPercentage: boolean = false) => {
  if (value === undefined || value === null) return 'N/A';
  if (value === 0) return '0';
  if (isPercentage) return `${value.toFixed(1)}%`;
  return value.toFixed(1);
};

const PlayerDetails: React.FC<PlayerDetailsProps> = ({ open, onClose, playerId }) => {
  const [value, setValue] = useState(0);
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [playerStats, setPlayerStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collegeStats, setCollegeStats] = useState<any[]>([]);
  const [sleeperStats, setSleeperStats] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPlayer, setEditedPlayer] = useState<Player | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open && playerId) {
      setLoading(true);
      setError(null);
      
      // Fetch player details
      getPlayerById(playerId)
        .then(data => {
          if (data) {
            setPlayer(data);
            
            // Fetch additional player stats from NFL API if possible
            return fetchPlayerStats(data.id, 2023)
              .then(statsData => {
                setPlayerStats(statsData);
              })
              .catch(err => {
                console.log('Could not fetch detailed stats, using basic data');
              });
          } else {
            setError('Player not found');
          }
        })
        .catch(error => {
          console.error('Error fetching player details:', error);
          setError('Failed to load player details. Please try again later.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, playerId]);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const generateWeeklyStats = () => {
    // If we have real weekly stats, use them
    if (playerStats?.statistics?.weekly) {
      return Object.entries(playerStats.statistics.weekly)
        .map(([week, stats]: [string, any]) => ({
          week: parseInt(week),
          opponent: stats.opponent?.name || 'BYE',
          result: stats.team_result || '-',
          stats: stats
        }))
        .sort((a, b) => a.week - b.week);
    }
    
    // Otherwise provide placeholder data
    return [];
  };

  const renderWeeklyStatsTable = () => {
    const weeklyData = generateWeeklyStats();
    
    if (weeklyData.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body1" color="text.secondary">
            No weekly stats available for this player.
          </Typography>
        </Box>
      );
    }
    
    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell>Week</TableCell>
              <TableCell>Opp</TableCell>
              <TableCell>Result</TableCell>
              {player?.position === 'QB' && (
                <>
                  <TableCell align="right">Comp/Att</TableCell>
                  <TableCell align="right">Pass Yds</TableCell>
                  <TableCell align="right">Pass TD</TableCell>
                  <TableCell align="right">INT</TableCell>
                  <TableCell align="right">Rush Yds</TableCell>
                  <TableCell align="right">Rush TD</TableCell>
                </>
              )}
              {(player?.position === 'RB') && (
                <>
                  <TableCell align="right">Rush Att</TableCell>
                  <TableCell align="right">Rush Yds</TableCell>
                  <TableCell align="right">Rush TD</TableCell>
                  <TableCell align="right">Rec</TableCell>
                  <TableCell align="right">Rec Yds</TableCell>
                  <TableCell align="right">Rec TD</TableCell>
                </>
              )}
              {(player?.position === 'WR' || player?.position === 'TE') && (
                <>
                  <TableCell align="right">Targets</TableCell>
                  <TableCell align="right">Rec</TableCell>
                  <TableCell align="right">Rec Yds</TableCell>
                  <TableCell align="right">Rec TD</TableCell>
                  <TableCell align="right">Rush Att</TableCell>
                  <TableCell align="right">Rush Yds</TableCell>
                </>
              )}
              <TableCell align="right">Fantasy Pts</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {weeklyData.map((week) => (
              <TableRow key={week.week} hover>
                <TableCell>{week.week}</TableCell>
                <TableCell>{week.opponent}</TableCell>
                <TableCell>{week.result}</TableCell>
                {player?.position === 'QB' && (
                  <>
                    <TableCell align="right">
                      {week.stats?.passing?.completions || 0}/{week.stats?.passing?.attempts || 0}
                    </TableCell>
                    <TableCell align="right">{week.stats?.passing?.yards || 0}</TableCell>
                    <TableCell align="right">{week.stats?.passing?.touchdowns || 0}</TableCell>
                    <TableCell align="right">{week.stats?.passing?.interceptions || 0}</TableCell>
                    <TableCell align="right">{week.stats?.rushing?.yards || 0}</TableCell>
                    <TableCell align="right">{week.stats?.rushing?.touchdowns || 0}</TableCell>
                  </>
                )}
                {player?.position === 'RB' && (
                  <>
                    <TableCell align="right">{week.stats?.rushing?.attempts || 0}</TableCell>
                    <TableCell align="right">{week.stats?.rushing?.yards || 0}</TableCell>
                    <TableCell align="right">{week.stats?.rushing?.touchdowns || 0}</TableCell>
                    <TableCell align="right">{week.stats?.receiving?.receptions || 0}</TableCell>
                    <TableCell align="right">{week.stats?.receiving?.yards || 0}</TableCell>
                    <TableCell align="right">{week.stats?.receiving?.touchdowns || 0}</TableCell>
                  </>
                )}
                {(player?.position === 'WR' || player?.position === 'TE') && (
                  <>
                    <TableCell align="right">{week.stats?.receiving?.targets || 0}</TableCell>
                    <TableCell align="right">{week.stats?.receiving?.receptions || 0}</TableCell>
                    <TableCell align="right">{week.stats?.receiving?.yards || 0}</TableCell>
                    <TableCell align="right">{week.stats?.receiving?.touchdowns || 0}</TableCell>
                    <TableCell align="right">{week.stats?.rushing?.attempts || 0}</TableCell>
                    <TableCell align="right">{week.stats?.rushing?.yards || 0}</TableCell>
                  </>
                )}
                <TableCell align="right">{calculateFantasyPoints(week.stats, player?.position).toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };
  
  const calculateFantasyPoints = (stats: any, position: string = 'WR') => {
    if (!stats) return 0;
    
    let points = 0;
    
    // Half PPR scoring
    if (stats.receiving) {
      points += (stats.receiving.yards || 0) * 0.1;  // 0.1 pts per receiving yard
      points += (stats.receiving.touchdowns || 0) * 6; // 6 pts per TD
      points += (stats.receiving.receptions || 0) * 0.5; // 0.5 pts per reception (Half PPR)
    }
    
    if (stats.rushing) {
      points += (stats.rushing.yards || 0) * 0.1; // 0.1 pts per rushing yard
      points += (stats.rushing.touchdowns || 0) * 6; // 6 pts per TD
    }
    
    if (stats.passing) {
      points += (stats.passing.yards || 0) * 0.04; // 0.04 pts per passing yard
      points += (stats.passing.touchdowns || 0) * 4; // 4 pts per passing TD
      points -= (stats.passing.interceptions || 0) * 2; // -2 pts per interception
    }
    
    return points;
  };

  const renderCareerStats = () => {
    const careerData = playerStats?.statistics?.career || {};
    
    if (!playerStats || !careerData) {
      return (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body1" color="text.secondary">
            No career stats available for this player.
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box>
        <Grid container spacing={3}>
          {player?.position === 'QB' && (
            <>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Passing</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Completions</Typography>
                    <Typography variant="h6">{careerData.passing?.completions || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Attempts</Typography>
                    <Typography variant="h6">{careerData.passing?.attempts || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Completion %</Typography>
                    <Typography variant="h6">
                      {careerData.passing?.attempts ? 
                        ((careerData.passing?.completions / careerData.passing?.attempts) * 100).toFixed(1) + '%' 
                        : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Yards</Typography>
                    <Typography variant="h6">{careerData.passing?.yards?.toLocaleString() || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">TDs</Typography>
                    <Typography variant="h6">{careerData.passing?.touchdowns || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">INTs</Typography>
                    <Typography variant="h6">{careerData.passing?.interceptions || 0}</Typography>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Rushing</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Attempts</Typography>
                    <Typography variant="h6">{careerData.rushing?.attempts || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Yards</Typography>
                    <Typography variant="h6">{careerData.rushing?.yards?.toLocaleString() || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">TDs</Typography>
                    <Typography variant="h6">{careerData.rushing?.touchdowns || 0}</Typography>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Career Summary</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Games Played</Typography>
                    <Typography variant="h6">{careerData.games_played || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Passer Rating</Typography>
                    <Typography variant="h6">{careerData.passing?.rating?.toFixed(1) || 'N/A'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">Total TDs</Typography>
                    <Typography variant="h6">
                      {(careerData.passing?.touchdowns || 0) + (careerData.rushing?.touchdowns || 0)}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </>
          )}
          
          {player?.position === 'RB' && (
            <>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Rushing</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Attempts</Typography>
                    <Typography variant="h6">{careerData.rushing?.attempts || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Yards</Typography>
                    <Typography variant="h6">{careerData.rushing?.yards?.toLocaleString() || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">TDs</Typography>
                    <Typography variant="h6">{careerData.rushing?.touchdowns || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">Yards Per Carry</Typography>
                    <Typography variant="h6">
                      {careerData.rushing?.attempts ? 
                        (careerData.rushing.yards / careerData.rushing.attempts).toFixed(1) 
                        : 'N/A'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Receiving</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Receptions</Typography>
                    <Typography variant="h6">{careerData.receiving?.receptions || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Targets</Typography>
                    <Typography variant="h6">{careerData.receiving?.targets || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Yards</Typography>
                    <Typography variant="h6">{careerData.receiving?.yards?.toLocaleString() || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">TDs</Typography>
                    <Typography variant="h6">{careerData.receiving?.touchdowns || 0}</Typography>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Career Summary</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Games Played</Typography>
                    <Typography variant="h6">{careerData.games_played || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Scrimmage Yards</Typography>
                    <Typography variant="h6">
                      {((careerData.rushing?.yards || 0) + (careerData.receiving?.yards || 0)).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">Total TDs</Typography>
                    <Typography variant="h6">
                      {(careerData.rushing?.touchdowns || 0) + (careerData.receiving?.touchdowns || 0)}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </>
          )}
          
          {(player?.position === 'WR' || player?.position === 'TE') && (
            <>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Receiving</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Receptions</Typography>
                    <Typography variant="h6">{careerData.receiving?.receptions || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Targets</Typography>
                    <Typography variant="h6">{careerData.receiving?.targets || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Yards</Typography>
                    <Typography variant="h6">{careerData.receiving?.yards?.toLocaleString() || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">TDs</Typography>
                    <Typography variant="h6">{careerData.receiving?.touchdowns || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">Yards Per Reception</Typography>
                    <Typography variant="h6">
                      {careerData.receiving?.receptions ? 
                        (careerData.receiving.yards / careerData.receiving.receptions).toFixed(1) 
                        : 'N/A'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Rushing</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Attempts</Typography>
                    <Typography variant="h6">{careerData.rushing?.attempts || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Yards</Typography>
                    <Typography variant="h6">{careerData.rushing?.yards?.toLocaleString() || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">TDs</Typography>
                    <Typography variant="h6">{careerData.rushing?.touchdowns || 0}</Typography>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Career Summary</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Games Played</Typography>
                    <Typography variant="h6">{careerData.games_played || 0}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Scrimmage Yards</Typography>
                    <Typography variant="h6">
                      {((careerData.rushing?.yards || 0) + (careerData.receiving?.yards || 0)).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">Total TDs</Typography>
                    <Typography variant="h6">
                      {(careerData.rushing?.touchdowns || 0) + (careerData.receiving?.touchdowns || 0)}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </>
          )}
        </Grid>
      </Box>
    );
  };

  const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ m: 0, p: 2, backgroundColor: '#121212', color: 'white' }}>
        {loading ? (
          <Typography variant="h6">Loading Player Details...</Typography>
        ) : player ? (
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar 
              sx={{ 
                width: 56, 
                height: 56, 
                bgcolor: theme => {
                  const color = getPositionColor(player.position);
                  return theme.palette[color].main;
                }
              }}
            >
              {getInitials(player.name)}
            </Avatar>
            <Box>
              <Typography variant="h6">{player.name}</Typography>
              <Box display="flex" alignItems="center" mt={0.5}>
                <Chip 
                  label={player.position} 
                  size="small" 
                  color={getPositionColor(player.position) as "primary" | "secondary" | "success" | "warning" | "info"}
                  sx={{ mr: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {player.team} • {player.age} years old • {player.experience} {player.experience === 1 ? 'year' : 'years'} experience
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <Typography variant="h6">Player Details</Typography>
        )}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'white',
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      {loading && <LinearProgress />}
      
      <DialogContent dividers sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}
        
        {!loading && player && (
          <>
            <Grid container spacing={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Grid item xs={12} md={3} sx={{ p: 2, borderRight: { md: 1 }, borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="text.secondary">Age</Typography>
                <Typography variant="h6">{player.age} years</Typography>
              </Grid>
              <Grid item xs={12} md={3} sx={{ p: 2, borderRight: { md: 1 }, borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="text.secondary">Experience</Typography>
                <Typography variant="h6">{player.experience} {player.experience === 1 ? 'year' : 'years'}</Typography>
              </Grid>
              <Grid item xs={12} md={3} sx={{ p: 2, borderRight: { md: 1 }, borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="text.secondary">Season PPG</Typography>
                <Typography variant="h6">
                  {player.stats.ppg ? player.stats.ppg.toFixed(1) : '-'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3} sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Season TDs</Typography>
                <Typography variant="h6">{player.stats.td || '-'}</Typography>
              </Grid>
            </Grid>

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={value} 
                onChange={handleChange} 
                aria-label="player stats tabs"
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Current Season" />
                <Tab label="Career Stats" />
                <Tab label="Fantasy History" />
                <Tab label="Depth Chart" />
                <Tab label="Injury History" />
              </Tabs>
            </Box>

            <TabPanel value={value} index={0}>
              <Typography variant="h6" gutterBottom>Week-by-Week Stats (2023)</Typography>
              {renderWeeklyStatsTable()}
            </TabPanel>

            <TabPanel value={value} index={1}>
              <Typography variant="h6" gutterBottom>Career Statistics</Typography>
              {renderCareerStats()}
            </TabPanel>

            <TabPanel value={value} index={2}>
              <Typography variant="h6" gutterBottom>Fantasy History</Typography>
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body1" color="text.secondary">
                  Fantasy history data is not available yet.
                </Typography>
              </Box>
            </TabPanel>

            <TabPanel value={value} index={3}>
              <Typography variant="h6" gutterBottom>Depth Chart</Typography>
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body1" color="text.secondary">
                  Depth chart data is not available yet.
                </Typography>
              </Box>
            </TabPanel>

            <TabPanel value={value} index={4}>
              <Typography variant="h6" gutterBottom>Injury History</Typography>
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body1" color="text.secondary">
                  Injury history data is not available yet.
                </Typography>
              </Box>
            </TabPanel>
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlayerDetails; 