const express = require('express');
const router = express.Router();

// Get draft pick values based on league settings
router.post('/values', async (req, res) => {
  try {
    const { leagueSettings } = req.body;
    
    if (!leagueSettings) {
      return res.status(400).json({ error: 'League settings are required' });
    }
    
    // Base values for picks in a standard 12-team PPR dynasty league
    const basePickValues = {
      '2024_round1_pick1': 1000,
      '2024_round1_pick2': 900,
      '2024_round1_pick3': 850,
      '2024_round1_pick4': 800,
      '2024_round1_pick5': 750,
      '2024_round1_pick6': 700,
      '2024_round1_pick7': 650,
      '2024_round1_pick8': 600,
      '2024_round1_pick9': 550,
      '2024_round1_pick10': 525,
      '2024_round1_pick11': 500,
      '2024_round1_pick12': 475,
      '2024_round2_pick1': 450,
      '2024_round2_pick2': 425,
      '2024_round2_pick3': 400,
      '2024_round2_pick4': 375,
      '2024_round2_pick5': 350,
      '2024_round2_pick6': 325,
      '2024_round2_pick7': 300,
      '2024_round2_pick8': 275,
      '2024_round2_pick9': 250,
      '2024_round2_pick10': 240,
      '2024_round2_pick11': 230,
      '2024_round2_pick12': 220,
      '2024_round3_pick1': 210,
      '2024_round3_pick12': 150,
      '2024_round4_pick1': 125,
      '2024_round4_pick12': 100,
      '2025_round1_pick1': 850,
      '2025_round1_pick12': 400,
      '2025_round2_pick1': 380,
      '2025_round2_pick12': 180,
      '2025_round3_pick1': 170,
      '2025_round3_pick12': 120,
      '2025_round4_pick1': 110,
      '2025_round4_pick12': 80,
      '2026_round1_pick1': 700,
      '2026_round1_pick12': 330,
      '2026_round2_pick1': 310,
      '2026_round2_pick12': 150,
      '2026_round3_pick1': 140,
      '2026_round3_pick12': 100,
      '2026_round4_pick1': 90,
      '2026_round4_pick12': 60,
    };
    
    // Calculate adjusted values based on league settings
    const values = {};
    
    // Apply format multiplier - picks are worth more in dynasty formats
    const formatMultiplier = 
      leagueSettings.format === 'Dynasty' ? 1.0 :
      leagueSettings.format === 'Keeper' ? 0.8 : 0.6;
    
    // Apply league size multiplier
    const leagueSizeMultiplier = 
      leagueSettings.league_size >= 14 ? 1.2 :
      leagueSettings.league_size >= 12 ? 1.0 :
      leagueSettings.league_size >= 10 ? 0.9 : 0.8;
    
    // Apply scoring multiplier (different scoring formats impact rookie values)
    const scoringMultiplier = 
      leagueSettings.scoring === 'TE Premium' ? 1.05 :
      leagueSettings.scoring === 'PPR' ? 1.0 :
      leagueSettings.scoring === 'Half-PPR' ? 0.95 : 0.9;
    
    // Calculate adjusted values
    Object.entries(basePickValues).forEach(([pickId, baseValue]) => {
      values[pickId] = Math.round(
        baseValue * formatMultiplier * leagueSizeMultiplier * scoringMultiplier
      );
    });
    
    res.json({ values });
  } catch (error) {
    console.error('Error calculating pick values:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 