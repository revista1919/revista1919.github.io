import React from 'react';
import { motion } from 'framer-motion';

function AboutSection() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="py-20 border-t border-b border-gray-100 bg-[#fdfdfd]"
    >
      <div className="max-w-4xl mx-auto px-6">
        <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#007398] block mb-6 text-center">
          Our Identity
        </span>
        <h2 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-8 text-center leading-tight">
          Fostering the next generation of scientific rigor
        </h2>
        <div className="space-y-6 text-lg leading-relaxed text-gray-700 font-serif italic">
          <p>
            The <span className="font-bold text-gray-900 not-italic">National Review of Sciences for Students</span> is an interdisciplinary peer-reviewed publication, curated by a global community of scholars and students.
          </p>
          <p className="border-l-4 border-[#007398] pl-6 py-2 bg-white shadow-sm">
            "Our goal is to democratize access to serious scientific publication, allowing students of all levels to experience the rigor of real research."
          </p>
          <p className="text-base not-italic text-gray-500 font-sans">
            We operate as an <span className="text-gray-900 font-medium text-sm tracking-wide uppercase">independent and free</span> initiative, without restrictive institutional affiliations, ensuring total editorial autonomy.
          </p>
        </div>
      </div>
    </motion.section>
  );
}

export default AboutSection;