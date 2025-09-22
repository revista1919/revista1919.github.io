import '../globals.css';  // Asegúrate de que globals.css incluya index.css
import { auth } from '../../firebase';  // Asume path correcto

export const metadata = {
  title: 'Revista Nacional de las Ciencias para Estudiantes',
  description: 'Una revista por y para estudiantes',
};

export default async function LocaleLayout({ children, params }) {
  // Await params (resuelve el error)
  const resolvedParams = await params;
  const locale = resolvedParams?.locale || 'es';  // Fallback

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-[#f4ece7] flex flex-col">
        {children}
      </body>
    </html>
  );
}

export async function generateStaticParams() {
  return [{ locale: 'es' }, { locale: 'en' }];  // Genera paths estáticos para ES/EN
}