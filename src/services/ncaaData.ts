import axios from 'axios';
import db from '../../database/db';
import dotenv from 'dotenv';

dotenv.config();

const NCAA_API_KEY = process.env.NCAA_API_KEY;
const NCAA_API_URL = 'https://api.ncaa.com/some-endpoint'; // Replace with actual endpoint

// Define a type for the player data
interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  value: number;
  age: number;
  experience: number;
}

// Define a type for the API response
interface NCAAApiResponse {
  players: Player[];
}

async function fetchNCAAData() {
  try {
    const response = await axios.get<NCAAApiResponse>(NCAA_API_URL, {
      headers: {
        'Authorization': `Bearer ${NCAA_API_KEY}`
      }
    });

    const players = response.data.players;
    insertPlayersIntoDB(players);
  } catch (error) {
    console.error('Error fetching NCAA data:', error);
  }
}

function insertPlayersIntoDB(players: Player[]) {
  const insertPlayer = db.prepare(`
    INSERT INTO players (id, name, position, team, value, age, experience)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      position=excluded.position,
      team=excluded.team,
      value=excluded.value,
      age=excluded.age,
      experience=excluded.experience;
  `);

  players.forEach((player: Player) => {
    insertPlayer.run(
      player.id,
      player.name,
      player.position,
      player.team,
      player.value,
      player.age,
      player.experience
    );
  });
}

fetchNCAAData(); 