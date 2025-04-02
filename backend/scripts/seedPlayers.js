require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Player = require('../models/Player');

// Sample player data
const players = [
  {
    name: 'Patrick Mahomes',
    position: 'QB',
    team: 'KC',
    age: 28,
    experience: 7,
    stats: {
      ppg: 21.5,
      yards: 4183,
      td: 27,
      receptions: 0,
      targets: 0,
      rushing_att: 78,
      snap_pct: 96.8,
      fantasy_points: 352.6
    },
    injury_status: 'Healthy',
    contract_status: 'Active',
    draft_year: 2017,
    draft_round: 1,
    draft_pick: 10,
    base_value: 750
  },
  {
    name: 'Josh Allen',
    position: 'QB',
    team: 'BUF',
    age: 28,
    experience: 6,
    stats: {
      ppg: 22.7,
      yards: 4306,
      td: 29,
      receptions: 0,
      targets: 0,
      rushing_att: 111,
      snap_pct: 97.2,
      fantasy_points: 363.2
    },
    injury_status: 'Healthy',
    contract_status: 'Active',
    draft_year: 2018,
    draft_round: 1,
    draft_pick: 7,
    base_value: 730
  },
  {
    name: 'Lamar Jackson',
    position: 'QB',
    team: 'BAL',
    age: 27,
    experience: 6,
    stats: {
      ppg: 23.1,
      yards: 3678,
      td: 24,
      receptions: 0,
      targets: 0,
      rushing_att: 148,
      snap_pct: 96.4,
      fantasy_points: 369.6
    },
    injury_status: 'Healthy',
    contract_status: 'Active',
    draft_year: 2018,
    draft_round: 1,
    draft_pick: 32,
    base_value: 720
  },
  {
    name: 'Christian McCaffrey',
    position: 'RB',
    team: 'SF',
    age: 28,
    experience: 7,
    stats: {
      ppg: 21.8,
      yards: 1459,
      td: 14,
      receptions: 67,
      targets: 83,
      rushing_att: 272,
      snap_pct: 81.5,
      fantasy_points: 348.8
    },
    injury_status: 'Healthy',
    contract_status: 'Active',
    draft_year: 2017,
    draft_round: 1,
    draft_pick: 8,
    base_value: 680
  },
  {
    name: 'Justin Jefferson',
    position: 'WR',
    team: 'MIN',
    age: 25,
    experience: 4,
    stats: {
      ppg: 19.4,
      yards: 1074,
      td: 5,
      receptions: 68,
      targets: 100,
      rushing_att: 0,
      snap_pct: 95.2,
      fantasy_points: 231.4
    },
    injury_status: 'Healthy',
    contract_status: 'Active',
    draft_year: 2020,
    draft_round: 1,
    draft_pick: 22,
    base_value: 650
  },
  {
    name: "Ja'Marr Chase",
    position: 'WR',
    team: 'CIN',
    age: 24,
    experience: 3,
    stats: {
      ppg: 17.2,
      yards: 1216,
      td: 7,
      receptions: 100,
      targets: 145,
      rushing_att: 4,
      snap_pct: 93.7,
      fantasy_points: 258.0
    },
    injury_status: 'Healthy',
    contract_status: 'Active',
    draft_year: 2021,
    draft_round: 1,
    draft_pick: 5,
    base_value: 640
  },
  {
    name: 'Travis Kelce',
    position: 'TE',
    team: 'KC',
    age: 34,
    experience: 11,
    stats: {
      ppg: 13.2,
      yards: 984,
      td: 5,
      receptions: 93,
      targets: 121,
      rushing_att: 0,
      snap_pct: 91.3,
      fantasy_points: 198.0
    },
    injury_status: 'Healthy',
    contract_status: 'Active',
    draft_year: 2013,
    draft_round: 3,
    draft_pick: 63,
    base_value: 520
  },
  {
    name: 'Saquon Barkley',
    position: 'RB',
    team: 'PHI',
    age: 27,
    experience: 6,
    stats: {
      ppg: 15.1,
      yards: 962,
      td: 6,
      receptions: 41,
      targets: 60,
      rushing_att: 247,
      snap_pct: 69.8,
      fantasy_points: 226.5
    },
    injury_status: 'Healthy',
    contract_status: 'Active',
    draft_year: 2018,
    draft_round: 1,
    draft_pick: 2,
    base_value: 580
  },
  {
    name: 'CeeDee Lamb',
    position: 'WR',
    team: 'DAL',
    age: 25,
    experience: 4,
    stats: {
      ppg: 20.1,
      yards: 1749,
      td: 12,
      receptions: 135,
      targets: 181,
      rushing_att: 14,
      snap_pct: 95.3,
      fantasy_points: 301.5
    },
    injury_status: 'Healthy',
    contract_status: 'Active',
    draft_year: 2020,
    draft_round: 1,
    draft_pick: 17,
    base_value: 630
  },
  {
    name: 'Brock Purdy',
    position: 'QB',
    team: 'SF',
    age: 24,
    experience: 2,
    stats: {
      ppg: 18.9,
      yards: 4280,
      td: 31,
      receptions: 0,
      targets: 0,
      rushing_att: 37,
      snap_pct: 98.1,
      fantasy_points: 302.4
    },
    injury_status: 'Healthy',
    contract_status: 'Active',
    draft_year: 2022,
    draft_round: 7,
    draft_pick: 262,
    base_value: 560
  }
];

// MongoDB connection options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

// Connect to MongoDB and seed data
const seedDatabase = async () => {
  try {
    // Connect to MongoDB with local connection string
    const mongoUri = 'mongodb://localhost:27017/dynasty_trade_calculator';
    console.log('Attempting to connect to local MongoDB...');
    
    await mongoose.connect(mongoUri, mongooseOptions);
    console.log('Connected to MongoDB');
    
    // Clear existing players
    await Player.deleteMany({});
    console.log('Cleared existing player data');
    
    // Insert new players
    const result = await Player.insertMany(players);
    console.log(`Successfully seeded ${result.length} players`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seeding function
seedDatabase(); 