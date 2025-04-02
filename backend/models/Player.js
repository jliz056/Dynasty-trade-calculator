const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  position: {
    type: String,
    required: true,
    enum: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
    trim: true
  },
  team: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    required: true
  },
  experience: {
    type: Number,
    required: true,
    default: 0
  },
  stats: {
    ppg: {
      type: Number,
      default: 0
    },
    yards: {
      type: Number,
      default: 0
    },
    td: {
      type: Number,
      default: 0
    },
    receptions: {
      type: Number,
      default: 0
    },
    targets: {
      type: Number,
      default: 0
    },
    rushing_att: {
      type: Number,
      default: 0
    },
    snap_pct: {
      type: Number,
      default: 0
    },
    fantasy_points: {
      type: Number,
      default: 0
    }
  },
  injury_status: {
    type: String,
    enum: ['Healthy', 'Questionable', 'Doubtful', 'Out', 'IR', 'PUP', 'Suspended'],
    default: 'Healthy'
  },
  last_updated: {
    type: Date,
    default: Date.now
  },
  contract_status: {
    type: String,
    default: 'Active'
  },
  draft_year: {
    type: Number
  },
  draft_round: {
    type: Number
  },
  draft_pick: {
    type: Number
  },
  base_value: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

// Create compound index for faster searching
PlayerSchema.index({ name: 'text', team: 1, position: 1 });

module.exports = mongoose.model('Player', PlayerSchema); 