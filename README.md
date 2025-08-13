# BMW Service Manager

Sistema de gestión completo para concesionario BMW desarrollado con Node.js, Express, SQLite y validaciones frontend/backend.

## 🚗 Características Principales

### Autenticación y Seguridad
- ✅ Sistema de login con validación de credenciales
- ✅ Manejo de sesiones seguro con express-session
- ✅ Contraseñas encriptadas con bcryptjs
- ✅ Middleware de autenticación y autorización

### Base de Datos
- ✅ Base de datos SQLite integrada
- ✅ Tablas: users, vehicles, customers, service_appointments
- ✅ Relaciones entre tablas con foreign keys
- ✅ Datos de ejemplo precargados

### Gestión de Vehículos BMW
- ✅ CRUD completo de vehículos
- ✅ Modelos específicos de BMW (X5, 330i, iX3, M3, etc.)
- ✅ Campos: modelo, año, VIN, color, precio, estado, kilometraje
- ✅ Validaciones de VIN, precios, años

### Gestión de Clientes
- ✅ Registro de clientes con datos completos
- ✅ Validaciones de email y teléfono
- ✅ Historial de clientes

### Citas de Servicio
- ✅ Programación de citas de mantenimiento
- ✅ Tipos de servicio predefinidos
- ✅ Estados de citas (programada, confirmada, completada, etc.)
- ✅ Asignación de vehículos a citas

### Validaciones Frontend
- ✅ Validación en tiempo real de formularios
- ✅ Mensajes de error personalizados
- ✅ Validación de formatos (email, VIN, teléfono)
- ✅ Sanitización de datos de entrada

## 🛠️ Tecnologías Utilizadas

### Backend
- Node.js
- Express.js
- SQLite3
- express-session (manejo de sesiones)
- bcryptjs (encriptación de contraseñas)
- express-validator (validaciones)
- body-parser

### Frontend
- HTML5
- CSS3 con efectos glassmorphism
- JavaScript vanilla
- Validaciones cliente/servidor
- Interfaz responsive

### DevOps
- Docker & Dockerfile optimizado
- Imagen multi-stage con Node.js Alpine
- Health checks integrados
- Usuario no-root para seguridad
- Publicado en DockerHub

## 📦 Instalación y Configuración

```bash
# Clonar el repositorio
cd Proyecto-final

# Instalar dependencias
npm install

# Iniciar la aplicación
npm start
```

La aplicación estará disponible en `http://localhost:3000`

## 👥 Credenciales de Acceso

### Usuario Único
- **Usuario:** `adrian`
- **Contraseña:** `papaelgallo2025`
- **Rol:** Administrador

⚠️ **Importante:** La aplicación requiere autenticación obligatoria. No es posible acceder sin login.

## 🗄️ Estructura de Base de Datos

### Tabla `users`
- id (INTEGER PRIMARY KEY)
- username (TEXT UNIQUE)
- email (TEXT UNIQUE)
- password (TEXT - encriptada)
- role (TEXT)
- created_at (DATETIME)

### Tabla `vehicles`
- id (INTEGER PRIMARY KEY)
- model (TEXT)
- year (INTEGER)
- vin (TEXT UNIQUE - 17 caracteres)
- color (TEXT)
- price (DECIMAL)
- status (TEXT)
- mileage (INTEGER)
- fuel_type (TEXT)
- transmission (TEXT)
- created_at (DATETIME)

### Tabla `customers`
- id (INTEGER PRIMARY KEY)
- first_name (TEXT)
- last_name (TEXT)
- email (TEXT UNIQUE)
- phone (TEXT)
- address (TEXT)
- created_at (DATETIME)

### Tabla `service_appointments`
- id (INTEGER PRIMARY KEY)
- customer_id (INTEGER - FK)
- vehicle_id (INTEGER - FK)
- service_type (TEXT)
- appointment_date (DATETIME)
- status (TEXT)
- notes (TEXT)
- created_at (DATETIME)

## 🎯 Funcionalidades Destacadas

### Dashboard
- Estadísticas en tiempo real
- Contadores de vehículos, clientes y citas
- Navegación intuitiva

### Gestión de Vehículos
- Catálogo completo de modelos BMW
- Validación de VIN de 17 caracteres
- Estados: disponible, vendido, reservado, mantenimiento
- Filtros por color, combustible, transmisión

### Sistema de Citas
- Calendario de citas integrado
- Tipos de servicio predefinidos
- Asignación automática de técnicos
- Historial de servicios

### Validaciones Robustas
- Frontend: JavaScript con validaciones en tiempo real
- Backend: express-validator con sanitización
- Base de datos: Constraints y foreign keys

## 🔐 Seguridad

- Contraseñas hasheadas con bcryptjs
- Sesiones seguras con express-session
- Validación de entrada en cliente y servidor
- Protección contra inyección SQL
- Middleware de autenticación

## 📱 Responsive Design

- Diseño adaptable a todos los dispositivos
- Interfaz moderna con efectos glassmorphism
- Colores y tipografía BMW
- Navegación móvil optimizada

## 🚀 Despliegue

### Despliegue Local con Node.js
```bash
# Para producción
NODE_ENV=production npm start
```

### Despliegue con Docker

#### Opción 1: Usar imagen de DockerHub (Recomendado)
```bash
# Descargar y ejecutar la imagen desde DockerHub
docker run -d -p 3000:3000 --name bmw-service miguel2210/bmw-service-manager:latest

# Acceder a la aplicación en http://localhost:3000
```

#### Opción 2: Construir imagen localmente
```bash
# Construir la imagen Docker
docker build -t bmw-service-manager .

# Ejecutar el contenedor
docker run -d -p 3000:3000 --name bmw-service bmw-service-manager

# Acceder a la aplicación en http://localhost:3000
```

#### Comandos Docker útiles
```bash
# Ver contenedores ejecutándose
docker ps

# Ver logs del contenedor
docker logs bmw-service

# Detener el contenedor
docker stop bmw-service

# Eliminar el contenedor
docker rm bmw-service

# Actualizar imagen desde DockerHub
docker pull miguel2210/bmw-service-manager:latest
```

### Imagen Docker en DockerHub
- **Repositorio:** `miguel2210/bmw-service-manager`
- **Tags disponibles:** `latest`, `v1.0.0`
- **URL:** https://hub.docker.com/r/miguel2210/bmw-service-manager

## 📄 Licencia

MIT License - Proyecto académico para gestión de concesionario BMW.

---

**BMW Service Manager** - Sistema integral de gestión automotriz con autenticación, base de datos y validaciones completas.