// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  // Rutas anteriores del prototipo
  redirects: {
    '/registro-paciente': '/paciente/registro',
  },
});
