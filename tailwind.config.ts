import type { Config } from 'tailwindcss';

// La interfaz usa los tokens de marca PDC definidos en estilos/app.css.
// Tailwind queda disponible para nuevas pantallas; preflight se desactiva para no alterar esos estilos.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: { pdc: { azul: '#00216f', hoja: '#002060', naranja: '#ff5100', celeste: '#7dbfe6' } },
      fontFamily: { titulo: ['Nunito', 'sans-serif'], texto: ['"Nunito Sans"', 'sans-serif'], hoja: ['"Archivo Narrow"', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
