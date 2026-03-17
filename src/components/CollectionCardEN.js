import React from 'react';
// Importamos el componente base y le forzamos el idioma a inglés con una prop
// Nota: No necesitamos el hook aquí, el componente base ya lo tiene.
import CollectionCard from './CollectionCard';

export default function CollectionCardEN(props) {
  return <CollectionCard {...props} />;
}