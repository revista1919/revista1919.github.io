// components/NewsletterSection.js
import React, { useState } from 'react';

function NewsletterSection() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);

  const scriptURL = "https://script.google.com/macros/s/AKfycbzyyR93tD85nPprIKAR_IDoWYBSAnlFwVes09rJgOM3KQsByg_MgzafWDK1BcFhfVJHew/exec";

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('nombre', nombre);
    formData.append('correo', correo);

    fetch(scriptURL, { method: "POST", body: formData })
      .then(r => r.text()) // 🔹 idéntico al Footer
      .then(() => {
        setEnviado(true);
        setNombre('');
        setCorreo('');
      })
      .catch(err => alert("Error al enviar: " + err));
  };

  return (
    <section className="newsletter-section bg-[#f5f0e6] text-[#4b3b2a] p-6 sm:p-12 rounded-lg shadow-lg max-w-2xl mx-auto my-8 text-center">
      <h2 className="text-2xl sm:text-3xl font-serif mb-4">
        Mantente al tanto de nuestros nuevos artículos
      </h2>
      <p className="mb-6 text-sm sm:text-base">
        Suscríbete a nuestra newsletter y recibe los últimos artículos y novedades de la Revista Nacional de las Ciencias para Estudiantes.
      </p>

      {!enviado ? (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <input
            type="text"
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="p-2 rounded border border-gray-400 w-full sm:w-auto flex-1 text-gray-800"
          />
          <input
            type="email"
            placeholder="Tu correo"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
            className="p-2 rounded border border-gray-400 w-full sm:w-auto flex-1 text-gray-800"
          />
          <button
            type="submit"
            className="bg-[#800020] text-white px-4 py-2 rounded hover:bg-[#5a0015] transition-colors"
          >
            Suscribirse
          </button>
        </form>
      ) : (
        <p className="text-green-700 font-semibold mt-4">¡Gracias por suscribirte!</p>
      )}
    </section>
  );
}

export default NewsletterSection;
