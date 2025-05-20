import axios from 'axios';

const GEOCODING_API_KEY = 'AIzaSyCF3odqgnIR29w-dJrbAJbs4GqM4JjAFyo'; // Zamień na swój klucz

/**
 * Funkcja do geokodowania adresu (miejscowość i/lub gmina)
 * @param {string} miejscowosc - nazwa miejscowości (może być pusta)
 * @param {string} gmina - nazwa gminy (może być pusta, ale przynajmniej jedno powinno być podane)
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function geocodeAddress(miejscowosc = '', gmina = '') {
  if (!miejscowosc && !gmina) return null;

  let address = '';
  if (miejscowosc) {
    address = `${miejscowosc}, ${gmina}, Polska`;
  } else {
    address = `Gmina ${gmina}, Polska`;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_API_KEY}`;

  try {
    const response = await axios.get(url);
    const location = response.data?.results?.[0]?.geometry?.location;
    return location || null;
  } catch (err) {
    console.error('Błąd geokodowania:', err.message);
    return null;
  }
}