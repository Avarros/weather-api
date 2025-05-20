import express from 'express';
import WeatherData from '../models/WeatherData.js';
import axios from 'axios';

const router = express.Router();

// 🔑 Klucz API do Google Geocoding
const GEOCODING_API_KEY = 'AIzaSyCF3odqgnIR29w-dJrbAJbs4GqM4JjAFyo';

// 📦 Funkcja do filtrowania wpisów niezależnie od wielkości liter
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

// 🌍 Funkcja pomocnicza do geokodowania (Google Maps)
async function geocodeAddress(miejscowosc, gmina) {
  const address = `${miejscowosc}, ${gmina}, Polska`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_API_KEY}`;

  try {
    const response = await axios.get(url);
    const location = response.data.results[0]?.geometry.location;
    return location || null;
  } catch (err) {
    console.error("Błąd geokodowania:", err.message);
    return null;
  }
}

// ✅ POST /api/ - dodaj nowy wpis pogodowy
router.post('/', async (req, res) => {
  try {
    const data = new WeatherData(req.body);
    await data.save();
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ GET /api/entries - zwraca wszystkie wpisy (opcjonalnie filtrowane)
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

// ✅ GET /api/gmina/:gmina - wpisy z danej gminy
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

// ✅ GET /api/miejscowosc/:miejscowosc - wpisy z miejscowości
router.get('/miejscowosc/:miejscowosc', async (req, res) => {
  try {
    const { miejscowosc } = req.params;
    const entries = await WeatherData.find({
      miejscowosc: { $regex: new RegExp(`^${miejscowosc}$`, 'i') }
    }).sort({ dataDodania: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET /api/mapa/poGminie/:gmina - dane na mapę (grupowane po miejscowościach)
router.get('/mapa/poGminie/:gmina', async (req, res) => {
  try {
    const { gmina } = req.params;
    const godzinaTemu = new Date(Date.now() - 6 * 60 * 60 * 1000); // ostatnie 6h

    const entries = await WeatherData.find({
      gmina: { $regex: new RegExp(`^${gmina}$`, 'i') },
      dataDodania: { $gte: godzinaTemu }
    });

    const grouped = {};

    for (const entry of entries) {
      const key = `${entry.miejscowosc.toLowerCase()}|${entry.gmina.toLowerCase()}`;
      if (!grouped[key]) {
        grouped[key] = {
          miejscowosc: entry.miejscowosc,
          gmina: entry.gmina,
          entries: []
        };
      }
      grouped[key].entries.push(entry);
    }

    const result = [];

    for (const key in grouped) {
      const { miejscowosc, gmina, entries } = grouped[key];
      const location = await geocodeAddress(miejscowosc, gmina);
      if (location) {
        result.push({
          miejscowosc,
          gmina,
          lat: location.lat,
          lng: location.lng,
          liczbaWpisow: entries.length
        });
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET /api/mapa/poMiejscowosci/:gmina/:miejscowosc
router.get('/mapa/poMiejscowosci/:gmina/:miejscowosc', async (req, res) => {
  try {
    const { gmina, miejscowosc } = req.params;
    const godzinaTemu = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const entries = await WeatherData.find({
      gmina: { $regex: new RegExp(`^${gmina}$`, 'i') },
      miejscowosc: { $regex: new RegExp(`^${miejscowosc}$`, 'i') },
      dataDodania: { $gte: godzinaTemu }
    });

    const location = await geocodeAddress(miejscowosc, gmina);
    if (!location) return res.status(404).json({ error: "Nie znaleziono współrzędnych" });

    res.json({
      miejscowosc,
      gmina,
      lat: location.lat,
      lng: location.lng,
      liczbaWpisow: entries.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET /api/average - średnie (ogólne lub z ostatniej godziny)
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