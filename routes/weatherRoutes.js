import express from 'express';
import WeatherData from '../models/WeatherData.js';

const router = express.Router();

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

// Lista wpisów użytkowników (filtrowanie po gminie i miejscowości)
router.get('/entries', async (req, res) => {
  try {
    const { gmina, miejscowosc } = req.query;
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
    if (miejscowosc) filter.miejscowosc = miejscowosc;
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
      },
      {
        $addFields: {
          opisWiatr: {
            $switch: {
              branches: [
                { case: { $lte: ["$avgWiatr", 19] }, then: "Brak wiatru" },
                { case: { $lte: ["$avgWiatr", 39] }, then: "Słaby" },
                { case: { $lte: ["$avgWiatr", 59] }, then: "Umiarkowany" },
                { case: { $lte: ["$avgWiatr", 79] }, then: "Silny" },
                { case: { $lte: ["$avgWiatr", 100] }, then: "Bardzo silny" }
              ],
              default: "-"
            }
          },
          opisOpad: {
            $switch: {
              branches: [
                { case: { $lte: ["$avgOpad", 19] }, then: "Brak opadów" },
                { case: { $lte: ["$avgOpad", 39] }, then: "Słabe" },
                { case: { $lte: ["$avgOpad", 59] }, then: "Umiarkowane" },
                { case: { $lte: ["$avgOpad", 79] }, then: "Silne" },
                { case: { $lte: ["$avgOpad", 100] }, then: "Ulewa" }
              ],
              default: "-"
            }
          }
        }
      },
      {
        $project: {
          avgTemp: 1,
          avgWilg: 1,
          avgCisn: 1,
          czyPada: 1,
          opisWiatr: 1,
          opisOpad: 1
        }
      }
    ]);

    res.json(result[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;