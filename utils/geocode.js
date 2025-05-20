import axios from 'axios';

const GEOCODING_API_KEY = 'AIzaSyCF3odqgnIR29w-dJrbAJbs4GqM4JjAFyo'; // Upewnij się, że ten klucz ma włączone Geocoding API

/**
 * Geokodowanie adresu z uwzględnieniem przypadków takich jak identyczna miejscowość i gmina.
 * @param {string} miejscowosc
 * @param {string} gmina
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function geocodeAddress(miejscowosc = '', gmina = '') {
  if (!miejscowosc && !gmina) return null;

  let address = '';

  if (miejscowosc && gmina) {
    if (miejscowosc.toLowerCase() === gmina.toLowerCase()) {
      address = `${miejscowosc}, Polska`;
    } else {
      address = `${miejscowosc}, ${gmina}, Polska`;
    }
  } else if (miejscowosc) {
    address = `${miejscowosc}, Polska`;
  } else {
    address = `${gmina}, Polska`;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_API_KEY}`;

  try {
    const response = await axios.get(url);

    if (
      response.data.status === 'OK' &&
      response.data.results.length > 0
    ) {
      const location = response.data.results[0].geometry.location;
      return location;
    }

    console.warn('Brak wyników geokodowania:', response.data.status, response.data.error_message);
    return null;
  } catch (err) {
    console.error('❌ Błąd geokodowania:', err.response?.data || err.message);
    return null;
  }
}