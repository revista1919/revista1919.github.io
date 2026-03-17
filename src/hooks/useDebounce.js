// hooks/useDebounce.js
import { useState, useEffect } from 'react';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Actualizar el valor con debounce después del delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancelar el timeout si el valor cambia o el componente se desmonta
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;