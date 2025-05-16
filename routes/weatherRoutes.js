const express = require('express');
const router = express.Router();
const WeatherData = require('../models/WeatherData');

router.post('/add', async (req, res) => {
  try {
    const entry = new WeatherData(req.body);
    await entry.save();
    res.status(201).json({ message: 'Dane zapisane' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/entries', async (req, res) => {
  const { gmina, miejscowość } = req.query;
  let filter = {};
  if (gmina) filter.gmina = gmina;
  if (miejscowość) filter.miejscowość = miejscowość;

  try {
    const entries = await WeatherData.find(filter).sort({ dataDodania: -1 });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/entry/:id', async (req, res) => {
  try {
    const entry = await WeatherData.findById(req.params.id);
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/average', async (req, res) => {
  const { gmina, miejscowość, lastHour } = req.query;
  let filter = {};
  if (gmina) filter.gmina = gmina;
  if (miejscowość) filter.miejscowość = miejscowość;
  if (lastHour === 'true') {
    filter.dataDodania = { $gte: new Date(Date.now() - 3600000) };
  }

  try {
    const result = await WeatherData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          avgTemp: { $avg: "$temperatura" },
          avgHumidity: { $avg: "$wilgotność" },
          avgPressure: { $avg: "$ciśnienieAtmosferyczne" },
          avgWind: { $avg: "$siłaWiatru" },
          avgRain: { $avg: "$siłaOpadów" },
          rainCount: { $sum: { $cond: [ "$czyPada", 1, 0 ] } }
        }
      }
    ]);
    res.json(result[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/mapData', async (req, res) => {
  try {
    const entries = await WeatherData.find({}, 'gmina miejscowość dataDodania temperatura wilgotność ciśnienieAtmosferyczne czyPada siłaWiatru siłaOpadów');
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
