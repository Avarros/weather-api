import mongoose from 'mongoose';

const WeatherDataSchema = new mongoose.Schema({
  nazwaUzytkownika: String,
  gmina: String,
  miejscowosc: String,
  dataDodania: { type: Date, default: Date.now },
  temperatura: Number,
  wilgotnosc: Number,
  cisnienieAtmosferyczne: Number,
  czyPada: Boolean,
  silaWiatru: Number,
  silaOpadow: Number,
  latitude: Number,   
  longitude: Number    
});

const WeatherData = mongoose.model('WeatherData', WeatherDataSchema);
export default WeatherData;
