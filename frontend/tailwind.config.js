// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./js/**/*.{js,jsx,ts,tsx}",     // <- tus módulos de la app
    "./pages/**/*.{js,jsx,ts,tsx}",  // <- si usás esta carpeta
    "./components/**/*.{js,jsx,ts,tsx}", // <- por si la tenés
  ],
  theme: { extend: {} },
  plugins: [],
};
