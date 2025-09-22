// app/[locale]/login/page.js
'use client';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import LoginSection from '@/components/LoginSection';

export default function LoginPage() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('Usuario logueado:', user.email);
      }
    });
    return () => unsubscribe();
  }, []);

  return <LoginSection />;
}
