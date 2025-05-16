import express from 'express';
import WeatherData from '../models/WeatherData.js';

const router = express.Router();

// Dodanie nowego wpisu
router.post('/', async (req, res) => {
  try {
    const data = new WeatherData(req.body);
    await data.save();
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Lista wpisów użytkowników (filtrowanie po gminie i miejscowości)
router.get('/entries', async (req, res) => {
  try {
    const { gmina, miejscowość } = req.query;
    const filter = {};
    if (gmina) filter.gmina = gmina;
    if (miejscowosc) filter.miejscowosc = miejscowosc;

    const entries = await WeatherData.find(filter).sort({ dataDodania: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Średnie ogólne lub z ostatniej godziny
router.get('/average', async (req, res) => {
  try {
    const { gmina, miejscowosc, ostatniaGodzina } = req.query;
    const filter = {};
    if (gmina) filter.gmina = gmina;
    if (miejscowość) filter.miejscowosc = miejscowosc;
    if (ostatniaGodzina === 'true') {
      const godzinaTemu = new Date(Date.now() - 60 * 60 * 1000);
      filter.dataDodania = { $gte: godzinaTemu };
    }

    const result = await WeatherData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          avgTemp: { $avg: "$temperatura" },
          avgWilg: { $avg: "$wilgotnosc" },
          avgCisn: { $avg: "$cisnienieAtmosferyczne" },
          avgWiatr: { $avg: "$silaWiatru" },
          avgOpad: { $avg: "$silaOpadow" }
        }
      }
    ]);

    res.json(result[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;