export { defaultProducts } from '../data/products';
import { defaultProducts } from '../data/products';

// The app keeps a fallback copy in browser storage so product updates still work when the network is down.
const STORAGE_KEYS = ['mavoryi-catalog', 'mavoryi-react-catalog'];

// Load the latest browser-saved catalog, with backward compatibility for old storage keys.
export function loadProducts() {
  try {
    for (const storageKey of STORAGE_KEYS) {
      const savedValue = localStorage.getItem(storageKey);

      if (!savedValue) {
        continue;
      }

      const parsedValue = JSON.parse(savedValue);
      if (Array.isArray(parsedValue) && parsedValue.length > 0) {
        return parsedValue;
      }
    }

    return defaultProducts;
  } catch (error) {
    console.warn('Could not read the saved catalog, so the default catalog is being used.', error);
    return defaultProducts;
  }
}

// Save the current catalog to the newest key so both the app and any older browser state remain consistent.
export function saveProducts(products) {
  try {
    const jsonValue = JSON.stringify(products);

    STORAGE_KEYS.forEach((storageKey) => {
      localStorage.setItem(storageKey, jsonValue);
    });
  } catch (error) {
    console.warn('Could not save the catalog locally.', error);
  }
}
