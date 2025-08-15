# BMW Service Manager - Instrucciones Docker

## 🚀 Ejecución con persistencia de datos

Para ejecutar BMW Service Manager con base de datos persistente:

### Opción 1: Volumen nombrado (Recomendado)
```bash
# Crear volumen persistente
docker volume create bmw-data

# Ejecutar con volumen
docker run -d -p 3000:3000 -v bmw-data:/app/data --name bmw-service miguel2210/bmw-service-manager:latest
```

### Opción 2: Carpeta local
```bash
# Crear carpeta local para datos
mkdir bmw-data

# Ejecutar montando carpeta local
docker run -d -p 3000:3000 -v $(pwd)/bmw-data:/app/data --name bmw-service miguel2210/bmw-service-manager:latest
```

### Opción 3: Windows
```cmd
# Crear carpeta y ejecutar
mkdir bmw-data
docker run -d -p 3000:3000 -v %cd%/bmw-data:/app/data --name bmw-service miguel2210/bmw-service-manager:latest
```

## 📋 Verificación

1. Accede a: http://localhost:3000
2. Login: usuario `adrian`, contraseña `papaelgallo2025`
3. Los datos se mantendrán aunque reinicies el contenedor

## 🔄 Gestión del contenedor

```bash
# Ver logs
docker logs bmw-service

# Detener
docker stop bmw-service

# Reiniciar
docker start bmw-service

# Eliminar contenedor (mantiene datos)
docker rm bmw-service
```

## ⚠️ Importante

- **SIEMPRE** usa un volumen para `/app/data` para mantener la base de datos
- Sin volumen, perderás todos los datos al reiniciar el contenedor