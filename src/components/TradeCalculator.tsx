import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  CardActions,
  Snackbar,
  Alert,
  Divider,
  Tooltip,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import ShareIcon from '@mui/icons-material/Share';
import HistoryIcon from '@mui/icons-material/History';
import InfoIcon from '@mui/icons-material/Info';
import PlayerDetails from './PlayerDetails';
import { saveTrade, getUserTrades, getPublicTrades, Trade as TradeInterface } from '../services/trade';
import { searchPlayers, type PlayerData } from '../services/player';
import { getPlayerValues, getPickValues } from '../services/localPlayerApi';

interface PlayerStats {
  position: string;
  ppg: number;
  yards: number;
  td: number;
  snap_pct: number;
  rushing_att: number;
}

interface LeagueSettings {
  scoring: 'PPR' | 'Half-PPR' | 'Standard' | 'TE Premium';
  format: 'Redraft' | 'Yearly' | 'Dynasty';
  league_size: number;
}

interface Player {
  id?: string;
  name: string;
  value: number;
  stats: PlayerStats;
}

interface TradeSide {
  players: PlayerData[];
  picks: string[];
}

interface InputState {
  playerName: string;
  pick: string;
}

interface PlayerValuesResponse {
  [key: string]: number;
}

interface PickValuesResponse {
  [key: string]: number;
}

// Replace the old calculatePlayerValue function with a function to get values from API cache
const getPlayerValue = (playerId: string, playerValues: Record<string, number>): number => {
  return playerValues[playerId] || 0;
};

// Replace the old calculatePickValue function with a function to get values from API cache
const getPickValue = (pickId: string, pickValues: Record<string, number>): number => {
  return pickValues[pickId] || 0;
};

const TradeCalculator = () => {
  const [settings, setSettings] = useState<LeagueSettings>({
    scoring: 'PPR',
    format: 'Dynasty',
    league_size: 12,
  });

  const [sideA, setSideA] = useState<TradeSide>({
    players: [],
    picks: [],
  });

  const [sideB, setSideB] = useState<TradeSide>({
    players: [],
    picks: [],
  });

  const [inputA, setInputA] = useState<InputState>({
    playerName: '',
    pick: '',
  });

  const [inputB, setInputB] = useState<InputState>({
    playerName: '',
    pick: '',
  });
  
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [tradeTitle, setTradeTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [savedTrades, setSavedTrades] = useState<TradeInterface[]>([]);
  const [publicTrades, setPublicTrades] = useState<TradeInterface[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info' | 'warning'
  });
  
  // New state variables for API integration
  const [playerValues, setPlayerValues] = useState<PlayerValuesResponse>({});
  const [pickValues, setPickValues] = useState<PickValuesResponse>({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PlayerData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // New state for player details modal
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerDetailsOpen, setPlayerDetailsOpen] = useState(false);

  // Function to get all player IDs from both sides
  const getAllPlayerIds = () => {
    const playerIds: string[] = [];
    
    sideA.players.forEach(player => {
      if (player.id) playerIds.push(player.id);
    });
    
    sideB.players.forEach(player => {
      if (player.id) playerIds.push(player.id);
    });
    
    return playerIds;
  };

  // Effect to load player and pick values when settings change
  useEffect(() => {
    const fetchValues = async () => {
      setIsLoading(true);
      try {
        const playerValuesResponse = await getPlayerValues();
        setPlayerValues(playerValuesResponse.values);
        
        const pickValuesResponse = await getPickValues();
        setPickValues(pickValuesResponse.values);
      } catch (error) {
        console.error("Error fetching values:", error);
        setNotification({
          open: true,
          message: 'Failed to fetch player and pick values',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchValues();
  }, [settings]);

  // Add this useEffect to load saved trades when the component mounts
  useEffect(() => {
    const loadSavedTrades = async () => {
      try {
        const userTrades = await getUserTrades();
        setSavedTrades(userTrades);
        
        const community = await getPublicTrades(10);
        setPublicTrades(community);
      } catch (error) {
        console.error('Error loading saved trades:', error);
      }
    };
    
    loadSavedTrades();
  }, []);

  // Effect to search for players when search query changes
  useEffect(() => {
    console.log('Search query changed:', searchQuery); // Debug log
    
    const searchTimer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          console.log('Calling searchPlayers with query:', searchQuery); // Debug log
          const results = await searchPlayers(searchQuery);
          console.log('Search results received:', results); // Debug log
          setSearchResults(results);
        } catch (error) {
          console.error("Error searching players:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);
    
    return () => clearTimeout(searchTimer);
  }, [searchQuery]);

  const addPlayer = (side: 'A' | 'B') => {
    const input = side === 'A' ? inputA : inputB;
    const setInput = side === 'A' ? setInputA : setInputB;
    
    if (!input.playerName) return;
    
    // Create a new player with required PlayerData fields
    const newPlayer: PlayerData = {
      id: `manual_${Date.now()}`,
      name: input.playerName,
      position: '',
      team: '',
      age: 0,
      experience: 0,
      stats: {
        position: '',
        ppg: 0,
        yards: 0,
        td: 0,
        snap_pct: 0,
        rushing_att: 0,
      },
      value: 500 // Default value for manually added players
    };

    if (side === 'A') {
      setSideA(prev => ({
        ...prev,
        players: [...prev.players, newPlayer],
      }));
    } else {
      setSideB(prev => ({
        ...prev,
        players: [...prev.players, newPlayer],
      }));
    }

    setInput(prev => ({ ...prev, playerName: '' }));
  };

  const addPick = (side: 'A' | 'B') => {
    const input = side === 'A' ? inputA : inputB;
    const setInput = side === 'A' ? setInputA : setInputB;
    
    if (!input.pick) return;

    if (side === 'A') {
      setSideA(prev => ({
        ...prev,
        picks: [...prev.picks, input.pick],
      }));
    } else {
      setSideB(prev => ({
        ...prev,
        picks: [...prev.picks, input.pick],
      }));
    }

    setInput(prev => ({ ...prev, pick: '' }));
  };

  const removePlayer = (side: 'A' | 'B', index: number) => {
    if (side === 'A') {
      setSideA(prev => ({
        ...prev,
        players: prev.players.filter((_, i) => i !== index),
      }));
    } else {
      setSideB(prev => ({
        ...prev,
        players: prev.players.filter((_, i) => i !== index),
      }));
    }
  };

  const removePick = (side: 'A' | 'B', index: number) => {
    if (side === 'A') {
      setSideA(prev => ({
        ...prev,
        picks: prev.picks.filter((_, i) => i !== index),
      }));
    } else {
      setSideB(prev => ({
        ...prev,
        picks: prev.picks.filter((_, i) => i !== index),
      }));
    }
  };

  const calculateTotalValue = (side: TradeSide) => {
    const playerValue = side.players.reduce((sum, player) => {
      if (player.id) {
        return sum + getPlayerValue(player.id, playerValues);
      }
      return sum + player.value;
    }, 0);
    
    const pickValue = side.picks.reduce((sum, pick) => {
      // Default pick value if not found in API values
      const defaultPickValue = 200;
      return sum + (getPickValue(pick, pickValues) || defaultPickValue);
    }, 0);
    
    return playerValue + pickValue;
  };

  const sideAValue = calculateTotalValue(sideA);
  const sideBValue = calculateTotalValue(sideB);
  const valueDifference = Math.abs(sideAValue - sideBValue);
  const fairTrade = valueDifference < 1000;

  const handleSaveClick = () => {
    setTradeTitle('');
    setIsPublic(false);
    setLeagueName('');
    setSaveDialogOpen(true);
  };
  
  const handleSaveClose = () => {
    setSaveDialogOpen(false);
  };
  
  const handleSaveTrade = async () => {
    if (!tradeTitle) {
      setNotification({
        open: true,
        message: 'Please enter a title for your trade',
        type: 'error'
      });
      return;
    }
    
    try {
      const totalValueA = calculateTotalValue(sideA);
      const totalValueB = calculateTotalValue(sideB);
      
      await saveTrade({
        title: tradeTitle,
        sideA,
        sideB,
        totalValueA,
        totalValueB,
        isPublic,
        league: {
          name: leagueName,
          scoring: settings.scoring,
          format: settings.format,
          size: settings.league_size
        }
      });
      
      setSaveDialogOpen(false);
      setNotification({
        open: true,
        message: 'Trade saved successfully!',
        type: 'success'
      });
      
      // Refresh the list of saved trades
      const userTrades = await getUserTrades();
      setSavedTrades(userTrades);
    } catch (error: any) {
      setNotification({
        open: true,
        message: error.message || 'Error saving trade',
        type: 'error'
      });
    }
  };
  
  const handleLoadClick = async () => {
    try {
      const userTrades = await getUserTrades();
      setSavedTrades(userTrades);
      
      const community = await getPublicTrades(10);
      setPublicTrades(community);
      
      setLoadDialogOpen(true);
    } catch (error: any) {
      setNotification({
        open: true,
        message: error.message || 'Error loading trades',
        type: 'error'
      });
    }
  };
  
  const handleLoadClose = () => {
    setLoadDialogOpen(false);
  };
  
  const handleLoadTrade = (trade: TradeInterface) => {
    // Convert TradePlayer[] to PlayerData[]
    const convertTradeSide = (side: typeof trade.sideA): TradeSide => ({
      players: side.players.map(player => ({
        id: `manual_${Date.now()}`, // Generate a new ID since TradePlayer might not have one
        name: player.name,
        position: player.stats?.position || '',
        team: '',
        age: 0,
        experience: 0,
        stats: {
          position: player.stats?.position || '',
          ppg: player.stats?.ppg || 0,
          yards: player.stats?.yards || 0,
          td: player.stats?.td || 0,
          snap_pct: player.stats?.snap_pct || 0,
          rushing_att: player.stats?.rushing_att || 0
        },
        value: player.value
      })),
      picks: side.picks
    });

    setSideA(convertTradeSide(trade.sideA));
    setSideB(convertTradeSide(trade.sideB));
    
    if (trade.league) {
      setSettings({
        scoring: trade.league.scoring as LeagueSettings['scoring'],
        format: trade.league.format as LeagueSettings['format'],
        league_size: trade.league.size || 12
      });
    }
    
    setLoadDialogOpen(false);
    setNotification({
      open: true,
      message: 'Trade loaded successfully!',
      type: 'success'
    });
  };
  
  const handleNotificationClose = () => {
    setNotification({
      ...notification,
      open: false
    });
  };

  const handlePlayerSearch = async (value: string, side: 'A' | 'B') => {
    console.log('handlePlayerSearch called with:', value, side); // Debug log
    if (side === 'A') {
      setInputA(prev => ({ ...prev, playerName: value }));
    } else {
      setInputB(prev => ({ ...prev, playerName: value }));
    }
    setSearchQuery(value);
  };

  const selectPlayerFromSearch = async (player: PlayerData, side: 'A' | 'B') => {
    console.log('selectPlayerFromSearch called with:', player, side); // Debug log
    
    // Add the player to the correct side
    if (side === 'A') {
      setSideA(prev => ({
        ...prev,
        players: [...prev.players, player],
      }));
      setInputA(prev => ({ ...prev, playerName: '' }));
    } else {
      setSideB(prev => ({
        ...prev,
        players: [...prev.players, player],
      }));
      setInputB(prev => ({ ...prev, playerName: '' }));
    }

    // Clear search results
    setSearchResults([]);
    setSearchQuery('');
    
    // Refresh player values
    try {
      const playerIds = [...getAllPlayerIds(), player.id];
      const playerValueData = await getPlayerValues();
      setPlayerValues(playerValueData.values);
    } catch (error) {
      console.error("Error fetching player values:", error);
    }
  };

  // Replace all instances of calculatePickValue with defaultPickValue
  const handlePickChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, side: 'A' | 'B') => {
    const value = e.target.value;
    if (side === 'A') {
      setInputA(prev => ({ ...prev, pick: value }));
    } else {
      setInputB(prev => ({ ...prev, pick: value }));
    }
  };

  const handlePlayerClick = (playerId: string) => {
    console.log('Clicked on player with ID:', playerId);
    setSelectedPlayerId(playerId);
    setPlayerDetailsOpen(true);
  };

  const handleClosePlayerDetails = () => {
    setPlayerDetailsOpen(false);
    setSelectedPlayerId(null);
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            League Settings
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Scoring</InputLabel>
              <Select
                value={settings.scoring}
                label="Scoring"
                onChange={(e) => setSettings(prev => ({ ...prev, scoring: e.target.value as any }))}
              >
                <MenuItem value="PPR">PPR</MenuItem>
                <MenuItem value="Half-PPR">Half-PPR</MenuItem>
                <MenuItem value="Standard">Standard</MenuItem>
                <MenuItem value="TE Premium">TE Premium</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Format</InputLabel>
              <Select
                value={settings.format}
                label="Format"
                onChange={(e) => setSettings(prev => ({ ...prev, format: e.target.value as any }))}
              >
                <MenuItem value="Dynasty">Dynasty</MenuItem>
                <MenuItem value="Yearly">Yearly</MenuItem>
                <MenuItem value="Redraft">Redraft</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>League Size</InputLabel>
              <Select
                value={settings.league_size}
                label="League Size"
                onChange={(e) => setSettings(prev => ({ ...prev, league_size: Number(e.target.value) }))}
              >
                {[8, 10, 12, 14, 16].map(size => (
                  <MenuItem key={size} value={size}>{size} Teams</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Side A
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Autocomplete
              fullWidth
              options={searchResults}
              getOptionLabel={(option) => `${option.name} (${option.position} - ${option.team})`}
              loading={isSearching}
              value={null}
              onChange={(_, player) => player && selectPlayerFromSearch(player, 'A')}
              onInputChange={(_, value) => handlePlayerSearch(value, 'A')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search Players"
                  variant="outlined"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {isSearching ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box>
                    <Typography variant="body1">
                      {option.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.position} • {option.team} • Value: {option.value}
                    </Typography>
                  </Box>
                </li>
              )}
            />
          </Box>
          <List>
            {sideA.players.map((player, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <Box>
                    <IconButton
                      edge="end"
                      aria-label="info"
                      onClick={() => {
                        console.log('Info button clicked for player:', player.name, 'with ID:', player.id);
                        handlePlayerClick(player.id || '');
                      }}
                      sx={{ mr: 1 }}
                    >
                      <InfoIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => removePlayer('A', index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemText
                  primary={player.name}
                  secondary={`${player.position} • ${player.team} • Value: ${player.value}`}
                  sx={{ 
                    '& .MuiListItemText-primary': { color: 'text.primary' },
                    '& .MuiListItemText-secondary': { color: 'text.secondary' }
                  }}
                />
              </ListItem>
            ))}
          </List>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Add Draft Pick (e.g., 2024 1st)"
              value={inputA.pick}
              onChange={(e) => handlePickChange(e, 'A')}
              sx={{ mt: 2 }}
            />
          </Box>
          <List>
            {sideA.picks.map((pick, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => removePick('A', index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText primary={pick} />
              </ListItem>
            ))}
          </List>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6">
                Total Value: {sideAValue} points
              </Typography>
              {sideAValue > sideBValue && (
                <Typography variant="body2" color="success.main">
                  Winning trade by {(sideAValue - sideBValue).toLocaleString()} points
                </Typography>
              )}
            </Box>
            <Box>
              <Typography variant="h6" align="right">
                Total Value: {sideBValue} points  
              </Typography>
              {sideBValue > sideAValue && (
                <Typography variant="body2" color="success.main" align="right">
                  Winning trade by {(sideBValue - sideAValue).toLocaleString()} points
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Side B
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Autocomplete
              fullWidth
              options={searchResults}
              getOptionLabel={(option) => `${option.name} (${option.position} - ${option.team})`}
              loading={isSearching}
              value={null}
              onChange={(_, player) => player && selectPlayerFromSearch(player, 'B')}
              onInputChange={(_, value) => handlePlayerSearch(value, 'B')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search Players"
                  variant="outlined"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {isSearching ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box>
                    <Typography variant="body1">
                      {option.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.position} • {option.team} • Value: {option.value}
                    </Typography>
                  </Box>
                </li>
              )}
            />
          </Box>
          <List>
            {sideB.players.map((player, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <Box>
                    <IconButton
                      edge="end"
                      aria-label="info"
                      onClick={() => {
                        console.log('Info button clicked for player:', player.name, 'with ID:', player.id);
                        handlePlayerClick(player.id || '');
                      }}
                      sx={{ mr: 1 }}
                    >
                      <InfoIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => removePlayer('B', index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemText
                  primary={player.name}
                  secondary={`${player.position} • ${player.team} • Value: ${player.value}`}
                  sx={{ 
                    '& .MuiListItemText-primary': { color: 'text.primary' },
                    '& .MuiListItemText-secondary': { color: 'text.secondary' }
                  }}
                />
              </ListItem>
            ))}
          </List>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Add Draft Pick (e.g., 2024 1st)"
              value={inputB.pick}
              onChange={(e) => handlePickChange(e, 'B')}
              sx={{ mt: 2 }}
            />
          </Box>
          <List>
            {sideB.picks.map((pick, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => removePick('B', index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText primary={pick} />
              </ListItem>
            ))}
          </List>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6">
                Total Value: {sideBValue} points
              </Typography>
              {sideBValue > sideAValue && (
                <Typography variant="body2" color="success.main">
                  Winning trade by {(sideBValue - sideAValue).toLocaleString()} points
                </Typography>
              )}
            </Box>
            <Box>
              <Typography variant="h6" align="right">
                Total Value: {sideAValue} points  
              </Typography>
              {sideAValue > sideBValue && (
                <Typography variant="body2" color="success.main" align="right">
                  Winning trade by {(sideAValue - sideBValue).toLocaleString()} points
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12}>
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Trade Analysis
          </Typography>
          
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>
                Calculating trade values...
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, height: '100%' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Side A Total Value
                  </Typography>
                  <Typography variant="h4">
                    {sideAValue.toLocaleString()}
                  </Typography>
                  {sideAValue > sideBValue && (
                    <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                      Side A wins trade by {(sideAValue - sideBValue).toLocaleString()} points
                    </Typography>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, height: '100%' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Side B Total Value
                  </Typography>
                  <Typography variant="h4">
                    {sideBValue.toLocaleString()}
                  </Typography>
                  {sideBValue > sideAValue && (
                    <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                      Side B wins trade by {(sideBValue - sideAValue).toLocaleString()} points
                    </Typography>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Box 
                  sx={{ 
                    mt: 2, 
                    p: 2, 
                    backgroundColor: fairTrade ? 'success.light' : 'warning.light',
                    borderRadius: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="h6" color={fairTrade ? 'success.dark' : 'warning.dark'}>
                    {fairTrade 
                      ? 'This looks like a fair trade!' 
                      : `Trade is unbalanced by ${valueDifference.toLocaleString()} points`}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          )}
        </Paper>
      </Grid>
      <Grid item xs={12}>
        <Paper sx={{ p: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSaveClick}
          >
            Save Trade
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<HistoryIcon />}
            onClick={handleLoadClick}
          >
            Load Trade
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ShareIcon />}
            onClick={() => {
              const url = window.location.href;
              navigator.clipboard.writeText(url);
              setNotification({
                open: true,
                message: 'Link copied to clipboard!',
                type: 'success'
              });
            }}
          >
            Share
          </Button>
        </Paper>
      </Grid>
      <PlayerDetails
        open={playerDetailsOpen}
        onClose={handleClosePlayerDetails}
        playerId={selectedPlayerId || undefined}
      />
    </Grid>
  );
};

export default TradeCalculator; 