'use client';
import { useEffect, useState } from 'react';

// Módulos de la aplicación (JavaScript del navegador en /public/edd). El orden importa.
const MODULOS = ['core', 'excel', 'importar', 'render', 'ui', 'vistas-mes', 'vistas-ficha', 'vistas-datos', 'app'];
const VERSION = '2026-10-22';

declare global {
  interface Window { XLSX?: unknown; JSZip?: unknown; __eddCargado?: boolean }
}

function cargarScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar ' + src));
    document.body.appendChild(s);
  });
}

export default function Cargador() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (window.__eddCargado) return;
    window.__eddCargado = true;
    (async () => {
      const [xlsx, jszip] = await Promise.all([import('xlsx'), import('jszip')]);
      window.XLSX = xlsx;
      window.JSZip = (jszip as unknown as { default: unknown }).default || jszip;
      for (const m of MODULOS) await cargarScript(`/edd/${m}.js?v=${VERSION}`);
    })().catch((e: Error) => setError(e.message));
  }, []);
  if (!error) return null;
  return <div className="aviso err" style={{ margin: 24 }}>La aplicación no terminó de cargar: {error}. Recarga la página.</div>;
}
