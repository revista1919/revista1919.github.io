import { redirect } from 'next/navigation';

export default function RootLayout({ children }) {
  // Redirige al locale por defecto
  redirect('/es');
}
