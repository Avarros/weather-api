import express from 'express';
import WeatherData from '../models/WeatherData.js';
import axios from 'axios';
import { geocodeAddress } from '../utils/geocode.js';

const router = express.Router();

// Funkcja pomocnicza do tworzenia filtra z regex ignorującym wielkość liter
const buildFilter = (gmina, miejscowosc) => {
  const filter = {};
  if (gmina) {
    filter.gmina = { $regex: new RegExp(`^${gmina}$`, 'i') };
  }
  if (miejscowosc) {
    filter.miejscowosc = { $regex: new RegExp(`^${miejscowosc}$`, 'i') };
  }
  return filter;
};

// Dodanie nowego wpisu
router.post('/', async (req, res) => {
  try {
    console.log('REQ.BODY:', req.body);

    const { gmina, miejscowosc } = req.body;

    if (!gmina && !miejscowosc) {
      return res.status(400).json({ error: 'Podaj co najmniej gminę lub miejscowość.' });
    }

    const coords = await geocodeAddress(miejscowosc, gmina);
    if (!coords) {
      return res.status(400).json({ error: 'Nie można uzyskać współrzędnych dla podanego adresu.' });
    }

    const data = new WeatherData({
      ...req.body,
      latitude: coords.lat,
      longitude: coords.lng
    });

    await data.save();
    res.status(201).json(data);
  } catch (err) {
    console.error('❌ Błąd podczas zapisu wpisu:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Lista wpisów użytkowników (filtrowanie po gminie i miejscowości, case-insensitive)
router.get('/entries', async (req, res) => {
  try {
    const { gmina, miejscowosc } = req.query;
    const filter = buildFilter(gmina, miejscowosc);
    const entries = await WeatherData.find(filter).sort({ dataDodania: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pobieranie danych tylko na podstawie gminy
router.get('/gmina/:gmina', async (req, res) => {
  try {
    const { gmina } = req.params;
    const entries = await WeatherData.find({
      gmina: { $regex: new RegExp(`^${gmina}$`, 'i') }
    }).sort({ dataDodania: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pobranie wpisów dla konkretnej miejscowości (case-insensitive)
router.get('/miejscowosc/:miejscowosc', async (req, res) => {
  const { miejscowosc } = req.params;
  try {
    const regex = new RegExp(`^${miejscowosc}$`, 'i');
    const entries = await WeatherData.find({ miejscowosc: { $regex: regex } }).sort({ dataDodania: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗺️ Endpoint 1: Punkty na mapę po gminie
router.get('/mapa/poGminie/:gmina', async (req, res) => {
  try {
    const gmina = decodeURIComponent(req.params.gmina);
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000); // ostatnie 6h
    const entries = await WeatherData.find({
      gmina: { $regex: new RegExp(`^${gmina}$`, 'i') },
      dataDodania: { $gte: since }
    }).lean();

    if (entries.length === 0) {
      return res.json([]);
    }

    const coord = await geocodeAddress('', gmina); // ✅ tylko gmina
    if (!coord) return res.status(404).json({ error: 'Nie znaleziono współrzędnych dla gminy.' });

    const randomizedEntries = entries.map(entry => ({
      ...entry,
      latitude: coord.lat + (Math.random() - 0.5) * 0.02,
      longitude: coord.lng + (Math.random() - 0.5) * 0.02
    }));

    res.json(randomizedEntries);
  } catch (err) {
    console.error('❌ Błąd w /mapa/poGminie:', err);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// 🗺️ Endpoint 2: Punkty na mapę po gminie i miejscowości
router.get('/mapa/poMiejscowosci/:gmina/:miejscowosc', async (req, res) => {
  try {
    const gmina = decodeURIComponent(req.params.gmina);
    const miejscowosc = decodeURIComponent(req.params.miejscowosc);
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000); // ostatnie 6h
    const entries = await WeatherData.find({
      gmina: { $regex: new RegExp(`^${gmina}$`, 'i') },
      miejscowość: miejscowosc,
      dataDodania: { $gte: since }
    }).lean();

    if (entries.length === 0) {
      return res.json([]);
    }

    const coord = await geocodeAddress(miejscowosc, gmina); // ✅ miejscowość i gmina
    if (!coord) return res.status(404).json({ error: 'Nie znaleziono współrzędnych dla miejscowości.' });

    const randomizedEntries = entries.map(entry => ({
      ...entry,
      latitude: coord.lat + (Math.random() - 0.5) * 0.02,
      longitude: coord.lng + (Math.random() - 0.5) * 0.02
    }));

    res.json(randomizedEntries);
  } catch (err) {
    console.error('❌ Błąd w /mapa/poMiejscowosci:', err);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});

// 📊 Endpoint: Średnie dane pogodowe
router.get('/average', async (req, res) => {
  try {
    const { gmina, miejscowosc, ostatniaGodzina } = req.query;
    const filter = buildFilter(gmina, miejscowosc);

    if (ostatniaGodzina === 'true') {
      const godzinaTemu = new Date(Date.now() - 60 * 60 * 1000);
      filter.dataDodania = { $gte: godzinaTemu };
    }

    const result = await WeatherData.aggregate([
      { $match: filter },
      {
        $facet: {
          averages: [
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
          ],
          padaStats: [
            {
              $group: {
                _id: "$czyPada",
                count: { $sum: 1 }
              }
            }
          ]
        }
      },
      {
        $project: {
          avgTemp: { $arrayElemAt: ["$averages.avgTemp", 0] },
          avgWilg: { $arrayElemAt: ["$averages.avgWilg", 0] },
          avgCisn: { $arrayElemAt: ["$averages.avgCisn", 0] },
          avgWiatr: { $arrayElemAt: ["$averages.avgWiatr", 0] },
          avgOpad: { $arrayElemAt: ["$averages.avgOpad", 0] },
          czyPada: {
            $let: {
              vars: {
                trueCount: {
                  $ifNull: [
                    {
                      $first: {
                        $filter: {
                          input: "$padaStats",
                          cond: { $eq: ["$$this._id", true] }
                        }
                      }
                    },
                    { count: 0 }
                  ]
                },
                falseCount: {
                  $ifNull: [
                    {
                      $first: {
                        $filter: {
                          input: "$padaStats",
                          cond: { $eq: ["$$this._id", false] }
                        }
                      }
                    },
                    { count: 0 }
                  ]
                }
              },
              in: {
                $cond: [
                  { $gt: ["$$trueCount.count", "$$falseCount.count"] }, "Tak",
                  {
                    $cond: [
                      { $gt: ["$$falseCount.count", "$$trueCount.count"] }, "Nie",
                      "-"
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    res.json(result[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;