Jacha Cholets - Plataforma de Reservas 🏰🇧🇴

Un sistema web dinámico diseñado para la gestión y reserva de los icónicos "Cholets" (Arquitectura Neoandina) en la ciudad de El Alto, Bolivia. Este proyecto cuenta con una interfaz pública para clientes y un panel de administración privado.

Tecnologías Utilizadas

Frontend: HTML5, CSS3 (Diseño Neoandino), JavaScript (Vanilla).

Backend: PHP (con PDO para mayor seguridad).

Base de Datos: MySQL.

 Requisitos Previos

Para poder ejecutar este proyecto en tu computadora, necesitas tener instalado un entorno de servidor local. Te recomendamos:

XAMPP, WAMP o Laragon.

Asegúrate de que los módulos Apache (servidor web) y MySQL (base de datos) estén en ejecución.

 Instalación y Ejecución

Sigue estos pasos para desplegar el proyecto localmente:

1. Ubicar el proyecto

Clona este repositorio o descomprime el archivo del proyecto dentro de la carpeta pública de tu servidor local.

Si usas XAMPP, la ruta suele ser: C:\xampp\htdocs\jacha-v3

2. Configurar la Base de Datos

Abre tu gestor de base de datos (por ejemplo, ingresando a http://localhost/phpmyadmin/).

Crea una nueva base de datos llamada jacha_db (o el nombre que prefieras).

Asegúrate de ejecutar tu script SQL para crear las tablas necesarias (por ejemplo, la tabla usuarios con las columnas id, email, password, rol).

3. Conectar el Sistema con la Base de Datos

Abre el archivo includes/db.php en tu editor de código (como VS Code) y actualiza las credenciales si es necesario:

$host = 'localhost';
$dbname = 'jacha_db'; // Pon aquí el nombre exacto de tu BD
$username = 'root';   // Usuario por defecto en XAMPP
$password = '';       // Contraseña por defecto en XAMPP (vacío)


4. Abrir el Sistema en el Navegador

Una vez configurado todo, abre tu navegador web y visita los siguientes enlaces:

 Vista de Clientes (Inicio): http://localhost/jacha-v3/

 Panel de Administración: http://localhost/jacha-v3/admin/login.php

