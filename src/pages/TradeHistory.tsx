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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  FormControlLabel,
  Switch,
  Tabs,
  Tab
} from '@mui/material';
import { getUserTrades, deleteTrade, getPublicTrades, updateTrade, saveTrade, Trade } from '../services/trade';
import { useNavigate } from 'react-router-dom';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import { auth } from '../config/firebase';

const TradeHistory = () => {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [publicTrades, setPublicTrades] = useState<Trade[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLeagueName, setEditLeagueName] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [newTrade, setNewTrade] = useState<Trade>({
    userId: auth.currentUser?.uid || 'anonymous',
    title: '',
    isPublic: false,
    league: {
      name: '',
      scoring: 'PPR',
      format: '1QB',
      size: 12
    },
    sideA: { players: [], picks: [] },
    sideB: { players: [], picks: [] },
    totalValueA: 0,
    totalValueB: 0,
    createdAt: new Date()
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadTrades = async () => {
      try {
        setLoading(true);
        const userTrades = await getUserTrades();
        setTrades(userTrades);
        
        const community = await getPublicTrades(20);
        setPublicTrades(community);
      } catch (error) {
        console.error('Error loading trades:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTrades();
  }, []);

  const handleDeleteClick = (tradeId: string) => {
    setTradeToDelete(tradeId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (tradeToDelete) {
      try {
        await deleteTrade(tradeToDelete);
        setTrades(trades.filter(trade => trade.id !== tradeToDelete));
        setDeleteDialogOpen(false);
        setTradeToDelete(null);
      } catch (error) {
        console.error('Error deleting trade:', error);
      }
    }
  };

  const handleEditClick = (trade: Trade) => {
    setEditTrade(trade);
    setEditTitle(trade.title);
    setEditLeagueName(trade.league?.name || '');
    setEditIsPublic(trade.isPublic);
    setEditDialogOpen(true);
  };

  const handleConfirmEdit = async () => {
    if (editTrade) {
      try {
        const updatedTrade = {
          ...editTrade,
          title: editTitle,
          isPublic: editIsPublic,
          league: {
            ...editTrade.league,
            name: editLeagueName
          }
        };
        
        await updateTrade(editTrade.id!, updatedTrade);
        
        // Update local trades list
        setTrades(trades.map(trade => 
          trade.id === editTrade.id ? updatedTrade : trade
        ));
        
        setEditDialogOpen(false);
        setEditTrade(null);
      } catch (error) {
        console.error('Error updating trade:', error);
      }
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleSaveTrade = async () => {
    if (!newTrade.title.trim()) {
      setError('Please enter a title for the trade');
      return;
    }

    try {
      const tradeToSave: Trade = {
        ...newTrade,
        league: {
          name: newTrade.league?.name || '',
          scoring: newTrade.league?.scoring || 'PPR', // Provide default value
          format: newTrade.league?.format || '1QB', // Provide default value
          size: newTrade.league?.size || 12 // Provide default value
        },
        userId: auth.currentUser?.uid || 'anonymous', // Use actual user ID if available
        createdAt: new Date()
      };

      const savedTrade = await saveTrade(tradeToSave);
      setTrades(prevTrades => [...prevTrades, savedTrade]);
      setSuccess('Trade saved successfully!');
      setNewTrade({
        title: '',
        userId: auth.currentUser?.uid || 'anonymous', 
        isPublic: false,
        league: {
          name: '',
          scoring: 'PPR',
          format: '1QB',
          size: 12
        },
        sideA: { players: [], picks: [] },
        sideB: { players: [], picks: [] },
        totalValueA: 0,
        totalValueB: 0,
        createdAt: new Date()
      });
    } catch (error) {
      setError('Failed to save trade');
    }
  };

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
      <Paper sx={{ mb: 4, p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Trade History
        </Typography>
        <Typography variant="body1">
          View, edit, and manage all your dynasty trades.
        </Typography>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ mb: 3 }}
        >
          <Tab label="My Trades" />
          <Tab label="Community Trades" />
        </Tabs>

        {currentTab === 0 && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/calculator')}
              >
                Create New Trade
              </Button>
            </Box>

            {trades.length > 0 ? (
              <Grid container spacing={3}>
                {trades.map((trade) => (
                  <Grid item xs={12} sm={6} md={4} key={trade.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="h6" noWrap sx={{ maxWidth: '80%' }}>
                            {trade.title}
                          </Typography>
                          <Box>
                            <IconButton size="small" onClick={() => handleEditClick(trade)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteClick(trade.id!)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        
                        {trade.league?.name && (
                          <Typography variant="body2" color="text.secondary">
                            League: {trade.league.name}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {trade.league?.format} - {trade.league?.scoring}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(trade.createdAt).toLocaleDateString()}
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
                            {trade.sideA.picks.length > 0 && (
                              <Typography variant="body2" noWrap>
                                Picks: {trade.sideA.picks.join(', ')}
                              </Typography>
                            )}
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" fontWeight="bold">
                              Side B: {trade.totalValueB} pts
                            </Typography>
                            <Typography variant="body2" noWrap>
                              {trade.sideB.players.map(p => p.name).join(', ')}
                            </Typography>
                            {trade.sideB.picks.length > 0 && (
                              <Typography variant="body2" noWrap>
                                Picks: {trade.sideB.picks.join(', ')}
                              </Typography>
                            )}
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
                        <Button
                          size="small"
                          startIcon={<ShareIcon />}
                          onClick={() => {
                            const url = `${window.location.origin}/calculator?trade=${trade.id}`;
                            navigator.clipboard.writeText(url);
                            alert('Link copied to clipboard!');
                          }}
                        >
                          Share
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" paragraph>
                  You haven't created any trades yet.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => navigate('/calculator')}
                >
                  Create Your First Trade
                </Button>
              </Box>
            )}
          </>
        )}

        {currentTab === 1 && (
          <>
            {publicTrades.length > 0 ? (
              <Grid container spacing={3}>
                {publicTrades.map((trade) => (
                  <Grid item xs={12} sm={6} md={4} key={trade.id}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" noWrap>
                          {trade.title}
                        </Typography>
                        
                        {trade.league?.name && (
                          <Typography variant="body2" color="text.secondary">
                            League: {trade.league.name}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {trade.league?.format} - {trade.league?.scoring}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(trade.createdAt).toLocaleDateString()}
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
                            {trade.sideA.picks.length > 0 && (
                              <Typography variant="body2" noWrap>
                                Picks: {trade.sideA.picks.join(', ')}
                              </Typography>
                            )}
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" fontWeight="bold">
                              Side B: {trade.totalValueB} pts
                            </Typography>
                            <Typography variant="body2" noWrap>
                              {trade.sideB.players.map(p => p.name).join(', ')}
                            </Typography>
                            {trade.sideB.picks.length > 0 && (
                              <Typography variant="body2" noWrap>
                                Picks: {trade.sideB.picks.join(', ')}
                              </Typography>
                            )}
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
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6">
                  No public trades available.
                </Typography>
              </Box>
            )}
          </>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Trade</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this trade? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Trade Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Trade</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="title"
            label="Trade Title"
            type="text"
            fullWidth
            variant="outlined"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
            sx={{ mb: 2, mt: 2 }}
          />
          <TextField
            margin="dense"
            id="league"
            label="League Name (optional)"
            type="text"
            fullWidth
            variant="outlined"
            value={editLeagueName}
            onChange={(e) => setEditLeagueName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={editIsPublic}
                onChange={(e) => setEditIsPublic(e.target.checked)}
                color="primary"
              />
            }
            label="Make this trade public (visible to community)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmEdit} color="primary" variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TradeHistory; 