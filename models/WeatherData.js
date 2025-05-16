const mongoose = require('mongoose');

const WeatherDataSchema = new mongoose.Schema({
  nazwaUzytkownika: String,
  gmina: String,
  miejscowość: String,
  dataDodania: { type: Date, default: Date.now },
  temperatura: Number,
  wilgotność: Number,
  ciśnienieAtmosferyczne: Number,
  czyPada: Boolean,
  siłaWiatru: Number,
  siłaOpadów: Number
});

module.exports = mongoose.model('WeatherData', WeatherDataSchema);
