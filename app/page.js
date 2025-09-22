import {redirect} from 'next/navigation';

export default function Home() {
  // Redirige a español como locale por defecto
  redirect('/es');
}
