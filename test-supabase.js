import { supabase } from './supabaseClient.js';

async function testConnection() {
    try {
        const { data, error } = await supabase.from('players').select('*');
        
        if (error) {
            console.error("Erreur :", error);
        } else {
            console.log("Connexion réussie !");
            console.log("Nombre de joueurs :", data.length);
        }
    } catch (err) {
        console.error("Erreur de connexion :", err);
    }
}

testConnection(); 