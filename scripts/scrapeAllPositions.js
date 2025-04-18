import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { supabase } from '../supabaseClient.js';
import 'dotenv/config';

// === Position URLs on PFR
const urls = {
  QB: "passing",
  RB: "rushing",
  WR: "receiving",
  TE: "receiving"  // TE are in the same page as WR, we'll filter by position
};

// === Main function
async function scrapeAndInsert(season = 2023) {
  for (const position of ["QB", "RB", "WR", "TE"]) {
    try {
      const url = `https://www.pro-football-reference.com/years/${season}/${urls[position]}.htm`;
      console.log(`📦 Scraping ${position}s from ${url}`);

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const html = await res.text();
      const match = html.match(/<!--([\s\S]*?table[\s\S]*?)-->/);
      if (!match) {
        console.error(`⚠️ No table found for ${position}`);
        continue;
      }

      const $ = cheerio.load(match[1]);
      const rows = $("table tbody tr");
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = $(rows[i]);
          const name = row.find("td[data-stat='player']").text().trim();
          const playerPos = row.find("td[data-stat='pos']").text().trim();
          const team = row.find("td[data-stat='team']").text().trim();

          // Skip if essential data is missing or if we're looking for TEs but this isn't one
          if (!name || !team || (position === "TE" && playerPos !== "TE")) continue;

          const playerId = `${name.toLowerCase().replace(/ /g, "-")}-${season}-${playerPos.toLowerCase()}`;
          const games = parseInt(row.find("td[data-stat='g']").text()) || 0;
          const passingYards = parseInt(row.find("td[data-stat='pass_yds']").text().replace(/,/g, "")) || 0;
          const rushingYards = parseInt(row.find("td[data-stat='rush_yds']").text().replace(/,/g, "")) || 0;
          const receivingYards = parseInt(row.find("td[data-stat='rec_yds']").text().replace(/,/g, "")) || 0;
          const touchdowns = parseInt(
            row.find("td[data-stat='pass_td'], td[data-stat='rush_td'], td[data-stat='rec_td']").text()
          ) || 0;
          const interceptions = parseInt(row.find("td[data-stat='pass_int']").text()) || 0;
          const fumbles = parseInt(row.find("td[data-stat='fumbles']").text()) || 0;

          // === Insert/Upsert into Supabase
          const { error: playerError } = await supabase.from("players").upsert({
            id: playerId,
            name,
            team,
            position: playerPos || position
          });
          if (playerError) throw new Error(`Player insert error: ${playerError.message}`);

          const { error: statsError } = await supabase.from("season_stats").insert({
            player_id: playerId,
            season,
            games_played: games,
            passing_yards: passingYards,
            rushing_yards: rushingYards,
            receiving_yards: receivingYards,
            touchdowns,
            interceptions,
            fumbles,
            fantasy_points: 0
          });
          if (statsError) throw new Error(`Stats insert error: ${statsError.message}`);

          console.log(`✅ ${position} | ${name} inserted`);
          successCount++;
        } catch (error) {
          console.error(`❌ Error processing row ${i}:`, error);
          errorCount++;
        }
      }

      console.log(`\nPosition ${position} completed:`);
      console.log(`Successfully processed: ${successCount} players`);
      console.log(`Errors encountered: ${errorCount}\n`);

    } catch (error) {
      console.error(`❌ Fatal error processing ${position}:`, error);
    }
  }

  console.log("🏁 All positions processed.");
}

// Get season from command line argument or use default
const seasonArg = process.argv[2];
const season = seasonArg ? parseInt(seasonArg) : 2023;

if (isNaN(season)) {
  console.error("Invalid season provided. Please provide a valid year.");
  process.exit(1);
}

scrapeAndInsert(season); 