import fetch from 'node-fetch';

export async function fetchNFLPlayers() {
  const url = 'https://api.sleeper.app/v1/players/nfl';
  const res = await fetch(url);
  const data = await res.json();

  // Simplify and format player data
  const players = Object.values(data)
    .filter((p: any) => p.active && p.position && p.team)
    .map((p: any) => ({
      id: p.player_id,
      name: p.full_name,
      position: p.position,
      team: p.team,
      value: Math.random() * 100, // Replace with real value logic later
    }));

  return players;
} 