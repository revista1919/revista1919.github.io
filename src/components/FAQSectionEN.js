import React from 'react';
import { motion } from 'framer-motion';

function FAQSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="faq-section bg-white p-6 rounded-xl shadow-lg mt-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h2
        className="text-2xl font-bold mb-4 text-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        Frequently Asked Questions
      </motion.h2>
      <motion.ul
        className="list-disc pl-5 text-base"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.li variants={itemVariants} className="mb-3">
          <strong>Who can publish?</strong> Any school or university student in the world.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>Can I use AI to help me write?</strong> No. It will be automatically rejected.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>How long does it take to respond?</strong> Between 1 and 3 weeks, depending on the volume of requests.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>How is an article reviewed?</strong> Double-blind review, without the author's name. There are students and professors who will review your article according to your area.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>What is the editorial process like?</strong> When you send us your article, reviewers and an editor are assigned to it, the latter will communicate with you when the review of your article is finished, to discuss changes or other issues.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>What will happen when my article is published?</strong> The article will appear on our website and will be indexed in Google Scholar. We are doing the procedures to get our ISSN. It is also possible that we invite you to our podcast, in addition to disseminating it on our Social Networks.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>In what format do I send the article?</strong> Word (.docx), Chicago style, 2,000–10,000 words.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>How can I apply for a position?</strong> From the "Apply for a position!" tab.
        </motion.li>
      </motion.ul>
    </motion.div>
  );
}

export default FAQSection;