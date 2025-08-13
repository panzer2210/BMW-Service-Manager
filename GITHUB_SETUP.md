# Instrucciones para subir a GitHub

## 📋 Pasos para crear el repositorio en GitHub

### 1. Crear repositorio en GitHub (Manual)
1. Ve a https://github.com/new
2. Inicia sesión con:
   - **Usuario:** Panzer2210
   - **Email:** carvajalmiguel431@gmail.com
   - **Contraseña:** Holastalin2210#

3. Crear nuevo repositorio:
   - **Nombre:** `BMW-Service-Manager`
   - **Descripción:** `Sistema completo de gestión para concesionario BMW con autenticación, base de datos SQLite, CRUD de vehículos, gestión de clientes y citas. Dockerizado y listo para producción.`
   - **Público** ✅
   - **NO** inicializar con README (ya tenemos uno)

### 2. Crear Personal Access Token (PAT)
1. Ve a GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Clic en "Generate new token (classic)"
3. Nombre: `BMW-Service-Manager-Token`
4. Scopes: Seleccionar `repo` (acceso completo a repositorios)
5. Generar token y copiarlo

### 3. Subir código (después de crear PAT)
```bash
# Configurar remote con el token
git remote set-url origin https://Panzer2210:[TOKEN]@github.com/Panzer2210/BMW-Service-Manager.git

# Subir código
git push -u origin main
```

## 🏗️ Estado actual del proyecto

✅ **Repositorio Git local configurado**
✅ **Commit inicial realizado**
✅ **Todos los archivos listos para subir**

### Archivos incluidos:
- 📋 README.md completo
- 🐳 Dockerfile optimizado
- 📦 package.json con dependencias
- 🚗 Código fuente completo
- 🎨 Archivos CSS y JavaScript
- 🔧 Configuración Docker
- 📝 Documentación completa

## 🔗 URL del repositorio (una vez creado)
`https://github.com/Panzer2210/BMW-Service-Manager`

## 🐳 Docker Hub ya publicado
`docker pull miguel2210/bmw-service-manager:latest`