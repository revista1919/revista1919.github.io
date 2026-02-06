import React from 'react';
import { motion } from 'framer-motion';

function FAQSection() {
  const faqs = [
    { q: "¿Quién puede publicar?", a: "Cualquier estudiante escolar o universitario del mundo." },
    { q: "¿Uso de IA?", a: "Prohibido. Cualquier rastro de generación por IA resultará en rechazo automático por ética académica." },
    { q: "¿Tiempos de respuesta?", a: "El proceso de revisión toma entre 1 y 3 semanas según la complejidad del área." },
    { q: "¿Cómo es la revisión?", a: "Sistema 'Doble Ciego': ni el autor ni el revisor conocen sus identidades para garantizar imparcialidad." },
    { q: "¿Publicación y Indexación?", a: "Los artículos se indexan en Google Académico y ya tenemos ISSN: 3087-2839." },
    { q: "¿Formato de envío?", a: "Archivos Word (.docx), siguiendo estrictamente el Estilo Chicago." }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-serif font-bold mb-12 border-b-2 border-black pb-4 inline-block">
          Preguntas Frecuentes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
              className="group p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white"
            >
              <h4 className="text-sm font-bold uppercase tracking-widest text-[#007398] mb-3 group-hover:translate-x-1 transition-transform">
                {faq.q}
              </h4>
              <p className="text-gray-600 font-serif leading-relaxed italic border-l border-gray-100 pl-4">
                {faq.a}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FAQSection;