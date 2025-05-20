import express from 'express';
import WeatherData from '../models/WeatherData.js';
import axios from 'axios';

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
    const data = new WeatherData(req.body);
    await data.save();
    res.status(201).json(data);
  } catch (err) {
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

// 🔑 Klucz API do Google Geocoding
const GEOCODING_API_KEY = 'AIzaSyCF3odqgnIR29w-dJrbAJbs4GqM4JjAFyo';

// 📌 Pomocnicza funkcja do geokodowania
async function geocodeAddress(miejscowosc, gmina) {
  const address = `${miejscowosc}, ${gmina}, Polska`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_API_KEY}`;
  try {
    const res = await axios.get(url);
    const location = res.data.results[0]?.geometry.location;
    return location || null;
  } catch (err) {
    console.error("Błąd geokodowania:", err.message);
    return null;
  }
}

// 🗺️ Endpoint 1: Punkty na mapę po gminie
router.get('/mapa/poGminie/:gmina', async (req, res) => {
  try {
    const { gmina } = req.params;
    const godzinyTemu = new Date(Date.now() - 6 * 60 * 60 * 1000);

    // Znajdź wszystkie wpisy z danej gminy w ostatnich 6 godzinach
    const entries = await WeatherData.find({
      gmina: { $regex: new RegExp(`^${gmina}$`, 'i') },
      dataDodania: { $gte: godzinyTemu }
    });

    if (!entries.length) return res.json([]);

    // Geokoduj tylko gminę
    const location = await geocodeAddress("", gmina); // miejscowość pusta
    if (!location) return res.status(404).json({ error: "Nie znaleziono współrzędnych gminy" });

    // Rozmieść wpisy losowo wokół punktu
    const randomized = entries.map(entry => {
      const offsetLat = (Math.random() - 0.5) * 0.02; // ~do 1km
      const offsetLng = (Math.random() - 0.5) * 0.02;
      return {
        lat: location.lat + offsetLat,
        lng: location.lng + offsetLng,
        miejscowosc: entry.miejscowosc,
        gmina: entry.gmina,
        silaOpadow: entry.silaOpadow,
        temperatura: entry.temperatura,
        wilgotnosc: entry.wilgotnosc,
        cisnienie: entry.cisnienieAtmosferyczne,
        dataDodania: entry.dataDodania,
        czyPada: entry.czyPada,
        silaWiatru: entry.silaWiatru
      };
    });

    res.json(randomized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 🗺️ Endpoint 2: Punkty na mapę po gminie i miejscowości
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