import { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Slider,
  Grid,
  Chip,
  Divider,
  Button,
  Tab,
  Tabs,
  IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import InfoIcon from '@mui/icons-material/Info';
import DownloadIcon from '@mui/icons-material/Download';
import { fetchSleeperPlayers, PlayerData } from '../services/player';

// Type for table headers and sorting
type Order = 'asc' | 'desc';
type PlayerSortKey = keyof PlayerData | 'stats.ppg' | 'stats.td' | 'team';

// Define the column structure
interface HeadCell {
  id: PlayerSortKey;
  label: string;
  numeric: boolean;
  sortable: boolean;
  width?: string;
}

const headCells: HeadCell[] = [
  { id: 'name', label: 'Player', numeric: false, sortable: true, width: '20%' },
  { id: 'position', label: 'Pos', numeric: false, sortable: true, width: '8%' },
  { id: 'team', label: 'Team', numeric: false, sortable: true, width: '8%' },
  { id: 'age', label: 'Age', numeric: true, sortable: true, width: '8%' },
  { id: 'experience', label: 'Exp', numeric: true, sortable: true, width: '8%' },
  { id: 'stats.ppg', label: 'PPG', numeric: true, sortable: true, width: '8%' },
  { id: 'stats.td', label: 'TD', numeric: true, sortable: true, width: '8%' },
  { id: 'value', label: 'Value', numeric: true, sortable: true, width: '10%' },
];

function PlayerRankings() {
  // State
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<PlayerSortKey>('value');
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('All');
  const [rookiesOnly, setRookiesOnly] = useState<boolean>(false);
  const [ageRange, setAgeRange] = useState<[number, number]>([20, 40]);
  const [experienceRange, setExperienceRange] = useState<[number, number]>([0, 15]);
  const [valueRange, setValueRange] = useState<[number, number]>([0, 10000]);
  const [tabValue, setTabValue] = useState(0);

  // Fetch players on component mount
  useEffect(() => {
    const loadPlayers = async () => {
      try {
        setLoading(true);
        const allPlayersObj = await fetchSleeperPlayers();
        
        // Convert the object to an array and filter for active players
        const playerArray = Object.values(allPlayersObj)
          .filter(player => 
            player.active && 
            ['QB', 'RB', 'WR', 'TE'].includes(player.position)
          )
          .map(player => ({
            id: player.player_id,
            name: player.full_name,
            position: player.position,
            team: player.team || 'FA',
            age: player.age || 0,
            experience: player.experience || 0,
            stats: {
              position: player.position,
              ppg: Math.random() * 20, // Mock data
              yards: Math.floor(Math.random() * 1500),
              td: Math.floor(Math.random() * 20),
              snap_pct: Math.random() * 100,
              rushing_att: Math.floor(Math.random() * 300)
            },
            value: Math.floor(500 + Math.random() * 9500) // Mock value between 500-10000
          } as PlayerData));
        
        setPlayers(playerArray);
      } catch (error) {
        console.error('Failed to load players:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadPlayers();
  }, []);

  // Handle sort request
  const handleRequestSort = (property: PlayerSortKey) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Compare function for sorting
  const getComparator = (
    order: Order,
    orderBy: PlayerSortKey
  ): (a: PlayerData, b: PlayerData) => number => {
    return order === 'desc'
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  };

  // Descending comparator
  function descendingComparator(a: PlayerData, b: PlayerData, orderBy: PlayerSortKey) {
    // Handle nested properties
    if (orderBy.includes('.')) {
      const [parent, child] = orderBy.split('.');
      // @ts-ignore - This is a safe operation as we know stats is a valid property
      if (b[parent][child] < a[parent][child]) return -1;
      // @ts-ignore - This is a safe operation as we know stats is a valid property
      if (b[parent][child] > a[parent][child]) return 1;
      return 0;
    }

    // Handle direct properties
    // @ts-ignore - This is a safe operation as orderBy is a valid key
    if (b[orderBy] < a[orderBy]) return -1;
    // @ts-ignore - This is a safe operation as orderBy is a valid key
    if (b[orderBy] > a[orderBy]) return 1;
    return 0;
  }
  
  // Filter players based on search and filters
  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      // Text search filter
      const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           player.team.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Position filter
      const matchesPosition = positionFilter === 'All' || player.position === positionFilter;
      
      // Rookie filter
      const matchesRookie = !rookiesOnly || player.experience === 0;
      
      // Range filters
      const matchesAge = player.age >= ageRange[0] && player.age <= ageRange[1];
      const matchesExperience = player.experience >= experienceRange[0] && player.experience <= experienceRange[1];
      const matchesValue = player.value >= valueRange[0] && player.value <= valueRange[1];
      
      return matchesSearch && matchesPosition && matchesRookie && matchesAge && matchesExperience && matchesValue;
    });
  }, [players, searchQuery, positionFilter, rookiesOnly, ageRange, experienceRange, valueRange]);
  
  // Sort filtered players
  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort(getComparator(order, orderBy));
  }, [filteredPlayers, order, orderBy]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = headCells.map(cell => cell.label).join(',');
    const rows = sortedPlayers.map(player => 
      `${player.name},${player.position},${player.team},${player.age},${player.experience},${player.stats.ppg},${player.stats.td},${player.value}`
    ).join('\n');
    
    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'player_rankings.csv');
    link.click();
  };

  // Render table based on tab selection
  const renderTable = () => (
    <TableContainer component={Paper} sx={{ maxHeight: 650 }}>
      <Table stickyHeader aria-label="player rankings table" size="small">
        <TableHead>
          <TableRow>
            {headCells.map((headCell) => (
              <TableCell
                key={headCell.id}
                align={headCell.numeric ? 'right' : 'left'}
                sortDirection={orderBy === headCell.id ? order : false}
                sx={{ width: headCell.width, fontWeight: 'bold' }}
              >
                {headCell.sortable ? (
                  <TableSortLabel
                    active={orderBy === headCell.id}
                    direction={orderBy === headCell.id ? order : 'asc'}
                    onClick={() => handleRequestSort(headCell.id)}
                  >
                    {headCell.label}
                  </TableSortLabel>
                ) : (
                  headCell.label
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedPlayers.map((player) => (
            <TableRow
              key={player.id}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(100, 181, 246, 0.1)',
                },
              }}
            >
              <TableCell component="th" scope="row">
                <Box display="flex" alignItems="center">
                  {player.name}
                  {player.experience === 0 && (
                    <Chip 
                      label="R" 
                      size="small" 
                      color="secondary"
                      sx={{ 
                        ml: 1, 
                        height: '20px', 
                        minWidth: '20px',
                        borderRadius: '50%',
                        '& .MuiChip-label': {
                          padding: '0px 2px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold'
                        }
                      }}
                    />
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Chip 
                  label={player.position} 
                  size="small" 
                  color={
                    player.position === 'QB' ? 'primary' :
                    player.position === 'RB' ? 'secondary' :
                    player.position === 'WR' ? 'success' :
                    player.position === 'TE' ? 'warning' : 
                    'default'
                  }
                />
              </TableCell>
              <TableCell>{player.team}</TableCell>
              <TableCell align="right">{player.age}</TableCell>
              <TableCell align="right">{player.experience}</TableCell>
              <TableCell align="right">{player.stats.ppg.toFixed(1)}</TableCell>
              <TableCell align="right">{player.stats.td}</TableCell>
              <TableCell align="right">
                <Typography 
                  variant="body2" 
                  color={player.value > 7500 ? 'success.main' : 
                         player.value > 5000 ? 'primary.main' : 
                         player.value > 2500 ? 'text.primary' : 
                         'text.secondary'}
                  fontWeight={player.value > 5000 ? 'bold' : 'normal'}
                >
                  {player.value.toLocaleString()}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          {sortedPlayers.length === 0 && !loading && (
            <TableRow>
              <TableCell colSpan={8} align="center">
                <Typography variant="body1" py={2}>
                  No players found matching the current filters.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // Loading indicator
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Player Rankings
        </Typography>
        <Typography variant="body1" gutterBottom color="text.secondary">
          Comprehensive player rankings with dynasty values calculated from our algorithm.
        </Typography>
        
        {/* Tabs for different views */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            aria-label="ranking view tabs"
          >
            <Tab label="Table View" />
            <Tab label="Comparison View" />
            <Tab label="Tier List" />
          </Tabs>
        </Box>
        
        {/* Filters section */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              variant="outlined"
              label="Search Players"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              size="small"
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Position</InputLabel>
              <Select
                value={positionFilter}
                label="Position"
                onChange={(e) => setPositionFilter(e.target.value)}
              >
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="QB">QB</MenuItem>
                <MenuItem value="RB">RB</MenuItem>
                <MenuItem value="WR">WR</MenuItem>
                <MenuItem value="TE">TE</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <Button 
              variant={rookiesOnly ? "contained" : "outlined"}
              color={rookiesOnly ? "secondary" : "primary"}
              onClick={() => setRookiesOnly(!rookiesOnly)}
              fullWidth
              sx={{ height: '40px' }}
            >
              {rookiesOnly ? "Rookies Only" : "All Players"}
            </Button>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <Button 
              variant="outlined" 
              startIcon={<FilterListIcon />}
              onClick={() => {/* Toggle advanced filters */}}
              fullWidth
              sx={{ height: '40px' }}
            >
              Filters
            </Button>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <Button 
              variant="outlined" 
              startIcon={<InfoIcon />}
              onClick={() => {/* Show value methodology */}}
              fullWidth
            >
              Value Key
            </Button>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <Button 
              variant="contained" 
              startIcon={<DownloadIcon />}
              onClick={exportToCSV}
              fullWidth
              sx={{ height: '40px' }}
            >
              Export CSV
            </Button>
          </Grid>
        </Grid>
        
        {/* Range filters */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>Age Range</Typography>
              <Slider
                value={ageRange}
                onChange={(_, newValue) => setAgeRange(newValue as [number, number])}
                valueLabelDisplay="auto"
                min={20}
                max={40}
                marks={[
                  { value: 20, label: '20' },
                  { value: 30, label: '30' },
                  { value: 40, label: '40' },
                ]}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>Experience (Years)</Typography>
              <Slider
                value={experienceRange}
                onChange={(_, newValue) => setExperienceRange(newValue as [number, number])}
                valueLabelDisplay="auto"
                min={0}
                max={15}
                marks={[
                  { value: 0, label: '0' },
                  { value: 7, label: '7' },
                  { value: 15, label: '15' },
                ]}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>Value Range</Typography>
              <Slider
                value={valueRange}
                onChange={(_, newValue) => setValueRange(newValue as [number, number])}
                valueLabelDisplay="auto"
                min={0}
                max={10000}
                marks={[
                  { value: 0, label: '0' },
                  { value: 5000, label: '5K' },
                  { value: 10000, label: '10K' },
                ]}
              />
            </Grid>
          </Grid>

          {/* Add visual indication of rookie filter */}
          {rookiesOnly && (
            <Box mt={2} display="flex" alignItems="center">
              <Chip 
                label="Rookies Only" 
                color="secondary" 
                onDelete={() => setRookiesOnly(false)} 
                sx={{ mr: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                Showing only players with 0 years of experience
              </Typography>
            </Box>
          )}
        </Paper>
        
        {/* Results count and sorted by */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="body2" color="text.secondary">
            {filteredPlayers.length} players • Sorted by {headCells.find(h => h.id === orderBy)?.label || 'Value'} ({order === 'desc' ? 'highest first' : 'lowest first'})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last updated: {new Date().toLocaleDateString()}
          </Typography>
        </Box>
        
        {/* Data table */}
        {tabValue === 0 && renderTable()}
        
        {/* Placeholder for other tabs */}
        {tabValue === 1 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6">Comparison View Coming Soon</Typography>
            <Typography variant="body1" color="text.secondary">
              Select multiple players to compare their stats and values side by side.
            </Typography>
          </Paper>
        )}
        
        {tabValue === 2 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6">Tier List View Coming Soon</Typography>
            <Typography variant="body1" color="text.secondary">
              Players grouped into value tiers by position.
            </Typography>
          </Paper>
        )}
      </Paper>
    </Container>
  );
}

export default PlayerRankings; 