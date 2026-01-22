import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const HomeSection = () => {
  const navigate = useNavigate();

  const cards = [
    { title: 'Artículos', desc: 'Explora las últimas investigaciones publicadas.', path: '/article', icon: '📄' },
    { title: 'Volúmenes', desc: 'Accede a las ediciones completas de la revista.', path: '/volume', icon: '📚' },
    { title: 'Enviar Artículo', desc: 'Consulta las bases y envía tu manuscrito.', path: '/submit', icon: '📤' },
    { title: 'Noticias', desc: 'Mantente al día con nuestras novedades.', path: '/new', icon: '📰' },
  ];

  return (
    <div className="py-12 max-w-7xl mx-auto px-4">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16"
      >
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-4">
          Bienvenidos a la Revista Científica
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto font-light">
          Un espacio dedicado a la difusión del conocimiento académico y la investigación de vanguardia.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <button 
            onClick={() => navigate('/article')}
            className="px-8 py-3 bg-[#007398] text-white font-bold uppercase tracking-widest text-xs rounded-sm hover:bg-[#005a77] transition-all shadow-md"
          >
            Explorar Artículos
          </button>
          <button 
            onClick={() => navigate('/about')}
            className="px-8 py-3 border border-gray-300 text-gray-700 font-bold uppercase tracking-widest text-xs rounded-sm hover:bg-white transition-all"
          >
            Conocer más
          </button>
        </div>
      </motion.div>

      {/* Grid de Accesos Directos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => (
          <motion.div
            key={card.path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => navigate(card.path)}
            className="bg-white p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:border-[#007398] transition-all cursor-pointer group rounded-sm"
          >
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform inline-block">
              {card.icon}
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">{card.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
            <div className="mt-4 text-[#007398] text-xs font-bold uppercase tracking-widest">
              Ir ahora →
            </div>
          </motion.div>
        ))}
      </div>

      {/* Sección Informativa Rápida */}
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="mt-20 p-8 bg-blue-50 border-l-4 border-[#007398] flex flex-col md:flex-row items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-serif font-bold text-blue-900">¿Quieres formar parte de nuestro equipo?</h2>
          <p className="text-blue-800/70">Estamos en busca de nuevos talentos para cargos administrativos y de revisión.</p>
        </div>
        <button 
          onClick={() => navigate('/admin')}
          className="mt-4 md:mt-0 px-6 py-2 bg-blue-900 text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-black transition-colors"
        >
          Ver Vacantes
        </button>
      </motion.div>
    </div>
  );
};

export default HomeSection;