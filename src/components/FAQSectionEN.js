import React from 'react';
import { motion } from 'framer-motion';

function FAQSection() {
  const faqs = [
    { q: "Who can publish?", a: "Any school or university student in the world." },
    { q: "Use of AI?", a: "Prohibited. Any trace of AI generation will result in automatic rejection for academic ethics." },
    { q: "Response times?", a: "The review process takes between 1 and 3 weeks depending on the complexity of the area." },
    { q: "How is the review?", a: "Double Blind System: neither the author nor the reviewer know their identities to ensure impartiality." },
    { q: "Publication and Indexing?", a: "Articles are indexed in Google Scholar and we have ISSN: 3087-2839." },
    { q: "Submission format?", a: "Word files (.docx), following strictly the Chicago Style." }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-serif font-bold mb-12 border-b-2 border-black pb-4 inline-block">
          Frequently Asked Questions
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