import express from 'express';
import WeatherData from '../models/WeatherData.js';

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
    const data = new WeatherData(req.body);
    await data.save();
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: 'Błąd podczas zapisu danych', details: err.message });
  }
});

// Pobierz wszystkie wpisy dla gminy lub miejscowości
router.get('/gmina/:gmina', async (req, res) => {
  try {
    const { gmina } = req.params;
    const data = await WeatherData.find(buildFilter(gmina, null)).sort({ dataDodania: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Błąd pobierania danych', details: err.message });
  }
});

router.get('/miejscowosc/:miejscowosc', async (req, res) => {
  try {
    const { miejscowosc } = req.params;
    const data = await WeatherData.find(buildFilter(null, miejscowosc)).sort({ dataDodania: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Błąd pobierania danych', details: err.message });
  }
});

// Oblicz ogólną średnią dla gminy
router.get('/ogolnaGmina/:gmina', async (req, res) => {
  try {
    const { gmina } = req.params;
    const filter = buildFilter(gmina, null);
    const averages = await WeatherData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          avgTemp: { $avg: '$temperatura' },
          avgWilgotnosc: { $avg: '$wilgotnosc' },
          avgCisnienie: { $avg: '$cisnienieAtmosferyczne' }
        }
      }
    ]);
    res.json(averages[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Błąd obliczania średnich', details: err.message });
  }
});

// Oblicz ogólną średnią dla miejscowości
router.get('/ogolnaMiejscowosc/:miejscowosc', async (req, res) => {
  try {
    const { miejscowosc } = req.params;
    const filter = buildFilter(null, miejscowosc);
    const averages = await WeatherData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          avgTemp: { $avg: '$temperatura' },
          avgWilgotnosc: { $avg: '$wilgotnosc' },
          avgCisnienie: { $avg: '$cisnienieAtmosferyczne' }
        }
      }
    ]);
    res.json(averages[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Błąd obliczania średnich', details: err.message });
  }
});

// Średnia z ostatniej godziny dla gminy
router.get('/ostatniaGodzinaGmina/:gmina', async (req, res) => {
  try {
    const { gmina } = req.params;
    const godzinaTemu = new Date(Date.now() - 60 * 60 * 1000);
    const filter = {
      ...buildFilter(gmina, null),
      dataDodania: { $gte: godzinaTemu }
    };
    const averages = await WeatherData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          avgTemp: { $avg: '$temperatura' },
          avgWilgotnosc: { $avg: '$wilgotnosc' },
          avgCisnienie: { $avg: '$cisnienieAtmosferyczne' }
        }
      }
    ]);
    res.json(averages[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Błąd obliczania średnich', details: err.message });
  }
});

// Średnia z ostatniej godziny dla miejscowości
router.get('/ostatniaGodzinaMiejscowosc/:miejscowosc', async (req, res) => {
  try {
    const { miejscowosc } = req.params;
    const godzinaTemu = new Date(Date.now() - 60 * 60 * 1000);
    const filter = {
      ...buildFilter(null, miejscowosc),
      dataDodania: { $gte: godzinaTemu }
    };
    const averages = await WeatherData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          avgTemp: { $avg: '$temperatura' },
          avgWilgotnosc: { $avg: '$wilgotnosc' },
          avgCisnienie: { $avg: '$cisnienieAtmosferyczne' }
        }
      }
    ]);
    res.json(averages[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Błąd obliczania średnich', details: err.message });
  }
});

export default router;