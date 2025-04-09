import { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Grid, 
  Paper, 
  Button, 
  Card, 
  CardContent, 
  CardActions,
  Divider,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar
} from '@mui/material';
import { getUserTrades, Trade } from '../services/trade';
import { fetchSleeperPlayers } from '../services/player';
import { auth } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import { Timestamp, FieldValue } from 'firebase/firestore';

// Define the player interfaces for different rankings
interface RankedPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  value: number;
  age?: number;
  experience?: number;
  isRookie?: boolean;
}

interface NCAAProspect {
  id: string;
  name: string;
  position: string;
  college: string;
  projectedRound: number;
  projectedPick?: number;
  notes: string;
}

// Add a utility function to format dates safely
const formatDate = (dateValue: Date | Timestamp | FieldValue): string => {
  if (dateValue instanceof Date) {
    return dateValue.toLocaleDateString();
  }
  if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
    return dateValue.toDate().toLocaleDateString();
  }
  return 'Pending';
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [topPlayers, setTopPlayers] = useState<RankedPlayer[]>([]);
  const [topQBs, setTopQBs] = useState<RankedPlayer[]>([]);
  const [topRBs, setTopRBs] = useState<RankedPlayer[]>([]);
  const [topWRs, setTopWRs] = useState<RankedPlayer[]>([]);
  const [topTEs, setTopTEs] = useState<RankedPlayer[]>([]);
  const [topProspects, setTopProspects] = useState<NCAAProspect[]>([]);
  const navigate = useNavigate();

  // Mock NCAA prospects data (in a real app, this would come from an API)
  const mockNCAAProspects: NCAAProspect[] = [
    { id: 'p1', name: 'Caleb Williams', position: 'QB', college: 'USC', projectedRound: 1, projectedPick: 1, notes: 'Elite arm talent, great mobility' },
    { id: 'p2', name: 'Drake Maye', position: 'QB', college: 'North Carolina', projectedRound: 1, projectedPick: 2, notes: 'Prototypical size, strong arm' },
    { id: 'p3', name: 'Marvin Harrison Jr.', position: 'WR', college: 'Ohio State', projectedRound: 1, projectedPick: 3, notes: 'Elite route runner, great hands' },
    { id: 'p4', name: 'Malik Nabers', position: 'WR', college: 'LSU', projectedRound: 1, projectedPick: 4, notes: 'Explosive playmaker' },
    { id: 'p5', name: 'Brock Bowers', position: 'TE', college: 'Georgia', projectedRound: 1, projectedPick: 8, notes: 'Athletic, mismatch weapon' },
    { id: 'p6', name: 'Olumuyiwa Fashanu', position: 'OT', college: 'Penn State', projectedRound: 1, projectedPick: 9, notes: 'Elite pass protector' },
    { id: 'p7', name: 'JC Latham', position: 'OT', college: 'Alabama', projectedRound: 1, projectedPick: 10, notes: 'Powerful run blocker' },
    { id: 'p8', name: 'Rome Odunze', position: 'WR', college: 'Washington', projectedRound: 1, projectedPick: 11, notes: 'Complete receiver, great speed' },
    { id: 'p9', name: 'Jonathon Brooks', position: 'RB', college: 'Texas', projectedRound: 1, projectedPick: 16, notes: 'Three-down back potential' },
    { id: 'p10', name: 'Carson Beck', position: 'QB', college: 'Georgia', projectedRound: 1, projectedPick: 20, notes: 'Strong arm, poised in pocket' }
  ];

  useEffect(() => {
    const loadUserData = async () => {
      try {
        setUser(auth.currentUser);
        
        // Load recent trades
        const trades = await getUserTrades();
        setRecentTrades(trades.slice(0, 5)); // Show 5 most recent trades
        
        // Load player rankings data
        await loadPlayerRankings();
        
        // Set NCAA prospects
        setTopProspects(mockNCAAProspects);
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Function to load and process player rankings
  const loadPlayerRankings = async () => {
    try {
      const allPlayersObj = await fetchSleeperPlayers();
      
      // Convert the object to an array and filter for active players
      const playerArray = Object.values(allPlayersObj)
        .filter(player => player.active && ['QB', 'RB', 'WR', 'TE'].includes(player.position))
        .map(player => ({
          id: player.player_id,
          name: player.full_name,
          position: player.position,
          team: player.team || 'FA',
          age: player.age || 0,
          experience: player.experience || 0,
          isRookie: player.experience === 0,
          value: calculateMockValue(player)
        } as RankedPlayer));
      
      // Sort by value (highest to lowest)
      const sortedPlayers = [...playerArray].sort((a, b) => b.value - a.value);
      
      // Set top players overall
      setTopPlayers(sortedPlayers.slice(0, 10));
      
      // Set top players by position
      setTopQBs(sortedPlayers.filter(p => p.position === 'QB').slice(0, 8));
      setTopRBs(sortedPlayers.filter(p => p.position === 'RB').slice(0, 8));
      setTopWRs(sortedPlayers.filter(p => p.position === 'WR').slice(0, 8));
      setTopTEs(sortedPlayers.filter(p => p.position === 'TE').slice(0, 8));
    } catch (error) {
      console.error('Error loading player rankings:', error);
    }
  };

  // Calculate a mock player value (in a real app, we would use a sophisticated algorithm)
  const calculateMockValue = (player: any): number => {
    const baseValues: { [key: string]: number } = {
      'QB': 800,
      'RB': 750,
      'WR': 730,
      'TE': 700
    };
    
    let value = baseValues[player.position] || 700;
    
    // Adjust for age
    if (player.age) {
      if (player.age < 25) {
        value += 100;
      } else if (player.age > 30) {
        value -= (player.age - 30) * 50;
      }
    }
    
    // Adjust for experience (rookies are valuable in dynasty)
    if (player.experience === 0) {
      value += 50;
    } else if (player.experience > 7) {
      value -= (player.experience - 7) * 30;
    }
    
    // Random variation for diversity
    value += Math.floor(Math.random() * 300) - 150;
    
    return Math.max(300, value); // Ensure minimum value
  };

  // Render a player row with value
  const renderPlayerRow = (player: RankedPlayer, index: number) => (
    <TableRow key={player.id} sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
      <TableCell>{index + 1}</TableCell>
      <TableCell>
        <Box display="flex" alignItems="center">
          {player.name}
          {player.isRookie && (
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
      <TableCell align="right">{player.value.toLocaleString()}</TableCell>
    </TableRow>
  );

  // Render a prospect row
  const renderProspectRow = (prospect: NCAAProspect, index: number) => (
    <TableRow key={prospect.id} sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
      <TableCell>{index + 1}</TableCell>
      <TableCell>{prospect.name}</TableCell>
      <TableCell>
        <Chip 
          label={prospect.position} 
          size="small" 
          color={
            prospect.position === 'QB' ? 'primary' :
            prospect.position === 'RB' ? 'secondary' :
            prospect.position === 'WR' ? 'success' :
            prospect.position === 'TE' ? 'warning' : 
            'default'
          }
        />
      </TableCell>
      <TableCell>{prospect.college}</TableCell>
      <TableCell>Round {prospect.projectedRound}</TableCell>
      <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {prospect.notes}
      </TableCell>
    </TableRow>
  );

  // Render ranking table
  const renderRankingTable = (title: string, players: RankedPlayer[], showPositionColumn: boolean = true) => (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <TableContainer sx={{ maxHeight: 350 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell width="5%">#</TableCell>
              <TableCell width="40%">Player</TableCell>
              {showPositionColumn && <TableCell width="10%">Pos</TableCell>}
              <TableCell width="15%">Team</TableCell>
              <TableCell width="15%" align="right">Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {players.map((player, index) => renderPlayerRow(player, index))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box display="flex" justifyContent="flex-end" mt={1}>
        <Button 
          size="small" 
          onClick={() => navigate('/rankings')}
        >
          View Full Rankings
        </Button>
      </Box>
    </Paper>
  );

  // Render prospect table
  const renderProspectTable = () => (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Top 10 NCAA Prospects
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <TableContainer sx={{ maxHeight: 350 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell width="5%">#</TableCell>
              <TableCell width="25%">Player</TableCell>
              <TableCell width="10%">Pos</TableCell>
              <TableCell width="20%">College</TableCell>
              <TableCell width="15%">Projection</TableCell>
              <TableCell width="25%">Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {topProspects.map((prospect, index) => renderProspectRow(prospect, index))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '50vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Grid container spacing={3}>
        {/* Welcome Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h4" gutterBottom>
              Welcome, {user?.displayName || user?.email?.split('@')[0] || 'Dynasty Manager'}!
            </Typography>
            <Typography variant="body1">
              Manage your dynasty trades, track values, and build your championship roster.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={() => navigate('/calculator')}
                sx={{ mr: 2 }}
              >
                Create New Trade
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={() => navigate('/rankings')}
                sx={{ mr: 2 }}
              >
                Player Rankings
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={() => navigate('/history')}
              >
                Trade History
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Player Rankings Section */}
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom>
            Player Rankings
          </Typography>
        </Grid>

        {/* Top Overall Players */}
        <Grid item xs={12} md={6}>
          {renderRankingTable('Top 10 Overall Players', topPlayers)}
        </Grid>

        {/* Top Prospects */}
        <Grid item xs={12} md={6}>
          {renderProspectTable()}
        </Grid>

        {/* Position Rankings */}
        <Grid item xs={12} sm={6} md={3}>
          {renderRankingTable('Top 8 Quarterbacks', topQBs, false)}
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          {renderRankingTable('Top 8 Running Backs', topRBs, false)}
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          {renderRankingTable('Top 8 Wide Receivers', topWRs, false)}
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          {renderRankingTable('Top 8 Tight Ends', topTEs, false)}
        </Grid>

        {/* Recent Trades */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h5" gutterBottom>
              Recent Trades
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {recentTrades.length > 0 ? (
              <Grid container spacing={2}>
                {recentTrades.map((trade) => (
                  <Grid item xs={12} sm={6} md={4} key={trade.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {trade.title}
                        </Typography>
                        {trade.league?.name && (
                          <Typography variant="body2" color="text.secondary">
                            League: {trade.league.name}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(trade.createdAt)}
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Typography variant="body2" fontWeight="bold">
                              Side A: {trade.totalValueA} pts
                            </Typography>
                            <Typography variant="body2" noWrap>
                              {trade.sideA.players.map(p => p.name).join(', ')}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" fontWeight="bold">
                              Side B: {trade.totalValueB} pts
                            </Typography>
                            <Typography variant="body2" noWrap>
                              {trade.sideB.players.map(p => p.name).join(', ')}
                            </Typography>
                          </Grid>
                        </Grid>
                      </CardContent>
                      <CardActions>
                        <Button 
                          size="small" 
                          onClick={() => navigate(`/calculator?trade=${trade.id}`)}
                        >
                          View Details
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography variant="body1" align="center" sx={{ py: 4 }}>
                You haven't created any trades yet. 
                <Button 
                  color="primary"
                  onClick={() => navigate('/calculator')}
                  sx={{ ml: 1 }}
                >
                  Create your first trade
                </Button>
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard; 