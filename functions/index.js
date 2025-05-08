const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const axios = require("axios");
const cors = require("cors")({
  origin: ['https://spa-0876.web.app', 'http://localhost:5000'], // make sure this matches your frontend domain exactly, no trailing slash
  allowedHeaders: [
    'Content-Type',
    'HX-Current-Url',
    'HX-Boosted',
    'HX-History-Restore-Request',
    'HX-Trigger',
    'HX-Request',
    'HX-Target',
    'HX-Trigger-Name',
    'HX-Prompt'
  ]
});
const pug = require("pug");
const path = require("path");
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
// Favorites data
exports.toggleFavorite = onRequest(async (req, res) => {
    let body = {};
    try {
    body = JSON.parse(req.rawBody.toString());
    } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { songId } = body;
  
    if (!songId) {
      return res.status(400).json({ error: 'Missing songId' });
    }
  
    try {
      const docRef = db.collection('favorites').doc(songId);
      const doc = await docRef.get();
  
      if (doc.exists) {
        // Unfavorite
        await docRef.delete();
        res.json({ status: 'removed' });
      } else {
        // Favorite
        await docRef.set({ favoritedAt: admin.firestore.FieldValue.serverTimestamp() });
        res.json({ status: 'added' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to toggle favorite' });
    }
  });
// Music Data
async function fetchMusicData() {
  const baseUrl = 'https://s-escobar-mt.github.io/s-escobar-mt.github.io-genshin-music-api';
  const url = `${baseUrl}/data.json`;

  try {
    const res = await axios.get(url);
    const rawData = res.data;

    // Format the data for the Pug template
    const formattedData = rawData.map(song => ({
      id: song.id,
      chara: song.chara,
      title: song.title,
      credits: song.credits,
      img: `${baseUrl}/images/${song.img}`,
      musicFile: `${baseUrl}/audio/${song.musicFile}`
    }));

    return formattedData;
  } catch (err) {
    console.error("Failed to fetch music data:", err.message);
    return []; // Return empty list on error
  }
}

// Firebase HTTP function: responds with rendered HTML from Pug
exports.songs = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const data = await fetchMusicData();

      // Compile and render Pug template
      const template = pug.compileFile(path.join(__dirname, 'views', 'cardList.pug'));
      const html = template({ data });

      // Send as HTML
      res.set('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch (error) {
      logger.error("Rendering failed:", error);
      res.status(500).send("Error rendering song list");
    }
  });
});
