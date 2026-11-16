# JACHA TOURS v3

## Cómo correrlo (ya tienes PostgreSQL y las tablas)
1. Cierra el servidor viejo (Ctrl+C).
2. Copia tu `backend/.env` de jacha-v2 a `jacha-v3/backend/.env`
   (y la carpeta `node_modules`, o ejecuta `npm install` dentro de `backend`).
3. En `.env` pon un JWT_SECRET propio (ver `.env.example`).
4. `cd jacha-v3/backend` → `npm start`
   Al arrancar actualiza solo la base (tablas nuevas, sin perder datos).
5. Abre http://localhost:3001/

## Direcciones
- Sitio:           /                    · Mapa: /mapa.html
- Clientes:        /login.html  (ingresar / crear cuenta) · /mi-cuenta.html
- Administración:  /admin/login.html

## Carpetas
- `public/`  → lo único que se sirve al navegador (HTML, CSS, JS, imágenes)
- `backend/` → servidor y base de datos (ya NO es accesible desde el navegador)
