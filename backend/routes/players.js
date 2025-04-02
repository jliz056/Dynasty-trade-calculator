const express = require('express');
const auth = require('../middleware/auth');
const Player = require('../models/Player');
const router = express.Router();

// Get players with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { position, search, page = 1, pageSize = 20 } = req.query;
    const query = {};
    
    // Apply filters if provided
    if (position) {
      query.position = position;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);
    
    // Execute query with pagination
    const players = await Player.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ name: 1 });
    
    // Get total count for pagination
    const totalCount = await Player.countDocuments(query);
    
    res.json({
      players,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get player by ID
router.get('/:id', async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    res.json(player);
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Calculate player values based on league settings
router.post('/values', async (req, res) => {
  try {
    const { playerIds, leagueSettings } = req.body;
    
    if (!playerIds || !Array.isArray(playerIds) || !leagueSettings) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    
    // Fetch players from database
    const players = await Player.find({ _id: { $in: playerIds } });
    
    // Calculate values based on league settings
    const values = {};
    
    players.forEach(player => {
      // Apply scoring multiplier
      let scoringMultiplier = 1.0;
      if (leagueSettings.scoring === 'TE Premium' && player.position === 'TE') {
        scoringMultiplier = 1.2;
      } else if (leagueSettings.scoring === 'Half-PPR') {
        scoringMultiplier = 0.75;
      } else if (leagueSettings.scoring === 'Standard') {
        scoringMultiplier = 0.5;
      }
      
      // Apply format multiplier
      const formatMultiplier = 
        leagueSettings.format === 'Dynasty' ? 1.3 :
        leagueSettings.format === 'Yearly' ? 1.1 : 1.0;
      
      // Apply league size multiplier
      const leagueSizeMultiplier = 
        leagueSettings.league_size >= 14 ? 1.2 :
        leagueSettings.league_size >= 12 ? 1.1 :
        leagueSettings.league_size >= 10 ? 1.0 : 0.9;
      
      // Calculate base value from player stats
      const baseValue = (
        player.stats.ppg * 10 +
        player.stats.yards * 0.1 +
        player.stats.td * 6 +
        player.stats.snap_pct * 0.2 +
        (player.stats.rushing_att || 0) * 0.1
      );
      
      // Apply multipliers
      const finalValue = Math.round(
        baseValue * scoringMultiplier * formatMultiplier * leagueSizeMultiplier
      );
      
      values[player._id] = finalValue;
    });
    
    res.json({ values });
  } catch (error) {
    console.error('Error calculating player values:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 