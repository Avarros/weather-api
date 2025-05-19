import express from 'express';
import WeatherData from '../models/WeatherData.js';

const router = express.Router();

// Funkcja pomocnicza do tworzenia filtra z regex ignorującym wielkość liter
const buildFilter = (gmina, miejscowosc) => {
  const filter = {};
  if (gmina) {
    filter.gmina = { $regex: new RegExp(^${gmina}$, 'i') };
  }
  if (miejscowosc) {
    filter.miejscowosc = { $regex: new RegExp(^${miejscowosc}$, 'i') };
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

// Średnie ogólne lub z ostatniej godziny (filtrowanie case-insensitive)
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