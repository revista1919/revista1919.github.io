// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Traducciones
const resources = {
  es: {
    translation: {
      header: {
        title: 'Revista Nacional de las Ciencias para Estudiantes',
      },
      tabs: {
        articles: 'Artículos',
        submit: 'Enviar Artículo',
        team: 'Nuestro Equipo',
        admin: 'Administración',
        about: 'Acerca de',
        guidelines: 'Guías',
        faq: 'Preguntas Frecuentes',
        news: 'Noticias',
        login: 'Login / Estado de Artículos',
      },
      // Agrega más traducciones según tus componentes
    },
  },
  en: {
    translation: {
      header: {
        title: 'The National Review of Student Sciences',
      },
      tabs: {
        articles: 'Articles',
        submit: 'Submit Article',
        team: 'Our Team',
        admin: 'Administration',
        about: 'About',
        guidelines: 'Guidelines',
        faq: 'Frequently Asked Questions',
        news: 'News',
        login: 'Login / Article Status',
      },
      // Agrega más traducciones según tus componentes
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'es', // Idioma predeterminado
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false, // React ya escapa los valores
    },
  });

export default i18n;