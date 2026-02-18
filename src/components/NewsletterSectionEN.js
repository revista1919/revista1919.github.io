// components/NewsletterSection.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

function NewsletterSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const scriptURL = "https://script.google.com/macros/s/AKfycbyAmrjSmCkMTeLhzrLbtPd46hO9-uEenRPcD2B_Jp52g3GSEDYQr1SezZnC9WoWfBySng/exec";

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('nombre', name); // si tu script espera "nombre" y "correo", déjalo así
    formData.append('correo', email);

    fetch(scriptURL, { method: "POST", body: formData })
      .then(r => r.text()) // 🔹 identical to Footer
      .then(() => {
        setSent(true);
        setName('');
        setEmail('');
      })
      .catch(err => alert("Error sending: " + err));
  };

  return (
    <section className="newsletter-section bg-[#f5f0e6] text-[#4b3b2a] p-6 sm:p-12 rounded-lg shadow-lg max-w-2xl mx-auto my-8 text-center">
      <h2 className="text-2xl sm:text-3xl font-serif mb-4">
        Stay up to date with our latest articles
      </h2>
      <p className="mb-6 text-sm sm:text-base">
        Subscribe to our newsletter and receive the latest articles and news from the National Review of Sciences for Students.
      </p>

      {!sent ? (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="p-2 rounded border border-gray-400 w-full sm:w-auto flex-1 text-gray-800"
          />
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="p-2 rounded border border-gray-400 w-full sm:w-auto flex-1 text-gray-800"
          />
          <button
            type="submit"
            className="bg-[#800020] text-white px-4 py-2 rounded hover:bg-[#5a0015] transition-colors"
          >
            Subscribe
          </button>
        </form>
      ) : (
        <p className="text-green-700 font-semibold mt-4">Thank you for subscribing!</p>
      )}
    </section>
  );
}

export default NewsletterSection;
