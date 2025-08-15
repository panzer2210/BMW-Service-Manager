#!/bin/bash
# sonar-bmw-analysis.sh
# Script completo de análisis de código estático con SonarQube para BMW Service Manager
# Autor: Security Team
# Fecha: $(date +%Y-%m-%d)

set -e  # Salir si hay errores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variables de configuración
PROJECT_NAME="bmw-service-manager"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="sonar-reports-$TIMESTAMP"
PROJECT_PATH="/home/kali/Proyecto-final"
SONAR_HOST="http://localhost:9000"
SONAR_PROJECT_KEY="bmw-service-manager"
SONAR_PROJECT_NAME="BMW Service Manager"
SONAR_TOKEN=""
SONAR_CONTAINER_NAME="sonarqube-bmw"

# Funciones auxiliares
print_header() {
    echo -e "${CYAN}================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================================${NC}"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar dependencias
check_dependencies() {
    print_step "Verificando dependencias..."
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado"
        exit 1
    else
        print_success "Docker encontrado: $(docker --version)"
    fi
    
    # Verificar Node.js y npm
    if ! command -v node &> /dev/null; then
        print_error "Node.js no está instalado"
        exit 1
    else
        print_success "Node.js encontrado: $(node --version)"
    fi
    
    # Verificar curl
    if ! command -v curl &> /dev/null; then
        print_warning "curl no encontrado, instalando..."
        sudo apt-get update && sudo apt-get install -y curl
    fi
    
    # Verificar jq
    if ! command -v jq &> /dev/null; then
        print_warning "jq no encontrado, instalando..."
        sudo apt-get install -y jq
    fi
    
    # Verificar wget
    if ! command -v wget &> /dev/null; then
        print_warning "wget no encontrado, instalando..."
        sudo apt-get install -y wget
    fi
}

# Instalar SonarScanner si no está disponible
install_sonar_scanner() {
    print_step "Verificando SonarScanner..."
    
    if ! command -v sonar-scanner &> /dev/null; then
        print_warning "SonarScanner no encontrado, instalando..."
        
        # Descargar SonarScanner
        SONAR_SCANNER_VERSION="4.8.0.2856"
        wget -q "https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux.zip"
        
        # Instalar
        sudo apt-get install -y unzip
        unzip -q "sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux.zip"
        sudo mv "sonar-scanner-${SONAR_SCANNER_VERSION}-linux" /opt/sonar-scanner
        sudo ln -sf /opt/sonar-scanner/bin/sonar-scanner /usr/local/bin/sonar-scanner
        
        # Cleanup
        rm "sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux.zip"
        
        print_success "SonarScanner instalado en /opt/sonar-scanner"
    else
        print_success "SonarScanner encontrado: $(sonar-scanner --version | head -1)"
    fi
}

# Configurar entorno
setup_environment() {
    print_step "Configurando entorno de análisis..."
    
    # Crear directorio de reportes
    mkdir -p "$REPORT_DIR"
    print_success "Directorio de reportes creado: $REPORT_DIR"
    
    # Cambiar al directorio del proyecto
    if [ -d "$PROJECT_PATH" ]; then
        cd "$PROJECT_PATH"
        print_success "Cambiado al directorio del proyecto: $PROJECT_PATH"
    else
        print_warning "Directorio del proyecto no encontrado, usando directorio actual"
        PROJECT_PATH=$(pwd)
    fi
}

# Iniciar SonarQube server
start_sonarqube() {
    print_step "Iniciando SonarQube server..."
    
    # Verificar si ya está corriendo
    if docker ps | grep -q "$SONAR_CONTAINER_NAME"; then
        print_success "SonarQube ya está corriendo"
        return 0
    fi
    
    # Parar contenedor existente si existe
    if docker ps -a | grep -q "$SONAR_CONTAINER_NAME"; then
        print_step "Parando contenedor SonarQube existente..."
        docker stop "$SONAR_CONTAINER_NAME" 2>/dev/null || true
        docker rm "$SONAR_CONTAINER_NAME" 2>/dev/null || true
    fi
    
    # Configurar límites del sistema para SonarQube
    echo "vm.max_map_count=524288" | sudo tee -a /etc/sysctl.conf
    echo "fs.file-max=131072" | sudo tee -a /etc/sysctl.conf
    sudo sysctl -w vm.max_map_count=524288
    sudo sysctl -w fs.file-max=131072
    
    # Iniciar SonarQube
    print_step "Descargando e iniciando SonarQube Community..."
    docker run -d \
        --name "$SONAR_CONTAINER_NAME" \
        -p 9000:9000 \
        -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
        sonarqube:community
    
    print_step "Esperando que SonarQube inicie (esto puede tomar 2-3 minutos)..."
    
    # Esperar que SonarQube esté listo
    local max_attempts=60
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$SONAR_HOST/api/system/status" | grep -q '"status":"UP"'; then
            print_success "SonarQube está listo"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "SonarQube no inició correctamente después de 5 minutos"
            docker logs "$SONAR_CONTAINER_NAME" | tail -20
            exit 1
        fi
        
        echo -n "."
        sleep 5
        ((attempt++))
    done
    
    echo ""
    print_success "SonarQube iniciado correctamente en $SONAR_HOST"
    print_warning "Credenciales por defecto: admin/admin"
}

# Configurar proyecto en SonarQube
setup_sonar_project() {
    print_step "Configurando proyecto en SonarQube..."
    
    # Esperar un poco más para asegurar que la API esté lista
    sleep 10
    
    # Cambiar contraseña por defecto (opcional)
    print_step "Configurando credenciales..."
    
    # Crear proyecto
    print_step "Creando proyecto BMW Service Manager..."
    
    # Crear proyecto usando API
    curl -s -u admin:admin -X POST \
        "$SONAR_HOST/api/projects/create" \
        -d "name=$SONAR_PROJECT_NAME" \
        -d "project=$SONAR_PROJECT_KEY" \
        > /dev/null 2>&1 || print_warning "Proyecto puede que ya exista"
    
    # Generar token para el proyecto
    print_step "Generando token de acceso..."
    
    TOKEN_RESPONSE=$(curl -s -u admin:admin -X POST \
        "$SONAR_HOST/api/user_tokens/generate" \
        -d "name=bmw-analysis-token")
    
    if echo "$TOKEN_RESPONSE" | grep -q "token"; then
        SONAR_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')
        print_success "Token generado correctamente"
        echo "$SONAR_TOKEN" > "$REPORT_DIR/sonar-token.txt"
    else
        print_warning "No se pudo generar token, usando credenciales básicas"
        SONAR_TOKEN="admin:admin"
    fi
}

# Crear archivo de configuración sonar-project.properties
create_sonar_config() {
    print_step "Creando configuración de SonarQube..."
    
    cat > sonar-project.properties << EOF
# Configuración del proyecto BMW Service Manager
sonar.projectKey=$SONAR_PROJECT_KEY
sonar.projectName=$SONAR_PROJECT_NAME
sonar.projectVersion=1.0.0

# Información del proyecto
sonar.organization=bmw-security-team
sonar.projectDescription=Sistema de gestión de servicios BMW - Análisis de seguridad

# Configuración de archivos fuente
sonar.sources=.
sonar.sourceEncoding=UTF-8

# Exclusiones
sonar.exclusions=node_modules/**,*.log,*.md,*.pdf,*.zip,*.tar.gz,sonar-reports-*/**,trivy-reports-*/**,.git/**,*.json,*.html,*.txt

# Configuración de lenguajes
sonar.javascript.file.suffixes=.js
sonar.css.file.suffixes=.css
sonar.html.file.suffixes=.html

# Configuración del servidor
sonar.host.url=$SONAR_HOST
sonar.login=$SONAR_TOKEN

# Configuración de análisis
sonar.scm.disabled=true
sonar.analysis.mode=preview

# Configuración de calidad
sonar.qualitygate.wait=true
sonar.qualitygate.timeout=300

# Configuración específica JavaScript
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.javascript.exclusions=node_modules/**

# Configuración de seguridad
sonar.security.hotspots.inheritFromParent=true
EOF
    
    print_success "Archivo sonar-project.properties creado"
}

# Ejecutar análisis con SonarScanner
run_sonar_analysis() {
    print_step "Ejecutando análisis de SonarScanner..."
    
    # Crear directorio de logs
    mkdir -p "$REPORT_DIR/logs"
    
    # Ejecutar SonarScanner con logging detallado
    if sonar-scanner -X > "$REPORT_DIR/logs/sonar-scanner.log" 2>&1; then
        print_success "Análisis de SonarScanner completado"
    else
        print_warning "Análisis completado con warnings (revisar logs)"
        tail -20 "$REPORT_DIR/logs/sonar-scanner.log"
    fi
}

# Obtener métricas del proyecto
get_project_metrics() {
    print_step "Obteniendo métricas del proyecto..."
    
    # Esperar que el análisis se procese
    sleep 30
    
    # Obtener métricas principales
    METRICS="ncloc,bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,reliability_rating,security_rating,sqale_rating"
    
    # Hacer petición a la API de métricas
    METRICS_RESPONSE=$(curl -s -u admin:admin \
        "$SONAR_HOST/api/measures/component?component=$SONAR_PROJECT_KEY&metricKeys=$METRICS")
    
    if echo "$METRICS_RESPONSE" | grep -q "measures"; then
        echo "$METRICS_RESPONSE" > "$REPORT_DIR/metrics.json"
        print_success "Métricas obtenidas correctamente"
    else
        print_warning "No se pudieron obtener métricas"
        echo "$METRICS_RESPONSE" > "$REPORT_DIR/metrics-error.json"
    fi
}

# Obtener issues (bugs, vulnerabilidades, code smells)
get_project_issues() {
    print_step "Obteniendo issues del proyecto..."
    
    # Obtener todos los issues
    curl -s -u admin:admin \
        "$SONAR_HOST/api/issues/search?componentKeys=$SONAR_PROJECT_KEY&ps=500" \
        > "$REPORT_DIR/all-issues.json"
    
    # Obtener solo vulnerabilidades
    curl -s -u admin:admin \
        "$SONAR_HOST/api/issues/search?componentKeys=$SONAR_PROJECT_KEY&types=VULNERABILITY&ps=100" \
        > "$REPORT_DIR/vulnerabilities.json"
    
    # Obtener solo bugs
    curl -s -u admin:admin \
        "$SONAR_HOST/api/issues/search?componentKeys=$SONAR_PROJECT_KEY&types=BUG&ps=100" \
        > "$REPORT_DIR/bugs.json"
    
    # Obtener code smells
    curl -s -u admin:admin \
        "$SONAR_HOST/api/issues/search?componentKeys=$SONAR_PROJECT_KEY&types=CODE_SMELL&ps=100" \
        > "$REPORT_DIR/code-smells.json"
    
    # Obtener security hotspots
    curl -s -u admin:admin \
        "$SONAR_HOST/api/hotspots/search?projectKey=$SONAR_PROJECT_KEY&ps=100" \
        > "$REPORT_DIR/security-hotspots.json"
    
    print_success "Issues del proyecto obtenidos"
}

# Generar reportes en diferentes formatos
generate_reports() {
    print_step "Generando reportes adicionales..."
    
    # Reporte HTML básico
    cat > "$REPORT_DIR/sonar-report.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>BMW Service Manager - SonarQube Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
        .metric-card { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #2196F3; }
        .issue { border-left: 4px solid #ff9800; padding: 10px; margin: 10px 0; background: #fff3e0; }
        .vulnerability { border-left-color: #f44336; background: #ffebee; }
        .bug { border-left-color: #e91e63; background: #fce4ec; }
        .code-smell { border-left-color: #ff9800; background: #fff3e0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚗 BMW Service Manager - Análisis SonarQube</h1>
        <p>Fecha: $(date)</p>
        <p>Proyecto: $SONAR_PROJECT_KEY</p>
        <p>URL SonarQube: <a href="$SONAR_HOST/dashboard?id=$SONAR_PROJECT_KEY">Ver en SonarQube</a></p>
    </div>
    
    <h2>📊 Métricas Principales</h2>
    <div id="metrics-container">
        <!-- Métricas se cargarán aquí -->
    </div>
    
    <h2>🐛 Issues Encontrados</h2>
    <div id="issues-container">
        <!-- Issues se cargarán aquí -->
    </div>
    
    <script>
        // El JavaScript para cargar datos se agregará dinámicamente
    </script>
</body>
</html>
EOF
    
    # Generar CSV con métricas
    if [ -f "$REPORT_DIR/metrics.json" ]; then
        echo "Metric,Value" > "$REPORT_DIR/metrics.csv"
        jq -r '.component.measures[] | "\(.metric),\(.value)"' "$REPORT_DIR/metrics.json" >> "$REPORT_DIR/metrics.csv" 2>/dev/null || true
    fi
    
    print_success "Reportes adicionales generados"
}

# Análisis específico BMW Service Manager
analyze_bmw_specific() {
    print_step "Ejecutando análisis específico BMW..."
    
    # Analizar archivos específicos del proyecto
    {
        echo "=== ANÁLISIS ESPECÍFICO BMW SERVICE MANAGER ==="
        echo "Fecha: $(date)"
        echo ""
        
        echo "=== ARCHIVOS ANALIZADOS ==="
        find . -name "*.js" -not -path "./node_modules/*" -not -path "./sonar-reports-*/*" | head -20
        echo ""
        
        echo "=== ESTRUCTURA DEL PROYECTO ==="
        tree -I 'node_modules|sonar-reports-*|trivy-reports-*|.git' -L 3 2>/dev/null || ls -la
        echo ""
        
        echo "=== DEPENDENCIAS PRINCIPALES ==="
        if [ -f "package.json" ]; then
            jq '.dependencies' package.json 2>/dev/null || echo "No se pudo leer package.json"
        fi
        echo ""
        
        echo "=== ARCHIVOS DE CONFIGURACIÓN ==="
        ls -la *.json *.js *.yml *.yaml 2>/dev/null || echo "No se encontraron archivos de configuración"
        
    } > "$REPORT_DIR/bmw-specific-analysis.txt"
    
    print_success "Análisis específico BMW completado"
}

# Generar resumen ejecutivo
generate_executive_summary() {
    print_step "Generando resumen ejecutivo..."
    
    {
        echo "====================================================================="
        echo "           RESUMEN EJECUTIVO SONARQUBE - BMW SERVICE MANAGER"
        echo "====================================================================="
        echo "Fecha de análisis: $(date)"
        echo "Proyecto: $SONAR_PROJECT_NAME"
        echo "Clave del proyecto: $SONAR_PROJECT_KEY"
        echo "URL del dashboard: $SONAR_HOST/dashboard?id=$SONAR_PROJECT_KEY"
        echo ""
        
        if [ -f "$REPORT_DIR/metrics.json" ]; then
            echo "=== MÉTRICAS PRINCIPALES ==="
            
            # Extraer métricas principales
            NCLOC=$(jq -r '.component.measures[] | select(.metric=="ncloc") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "N/A")
            BUGS=$(jq -r '.component.measures[] | select(.metric=="bugs") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "0")
            VULNERABILITIES=$(jq -r '.component.measures[] | select(.metric=="vulnerabilities") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "0")
            CODE_SMELLS=$(jq -r '.component.measures[] | select(.metric=="code_smells") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "0")
            SECURITY_RATING=$(jq -r '.component.measures[] | select(.metric=="security_rating") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "N/A")
            RELIABILITY_RATING=$(jq -r '.component.measures[] | select(.metric=="reliability_rating") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "N/A")
            MAINTAINABILITY_RATING=$(jq -r '.component.measures[] | select(.metric=="sqale_rating") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "N/A")
            
            echo "Líneas de código: $NCLOC"
            echo "Bugs: $BUGS"
            echo "Vulnerabilidades: $VULNERABILITIES"
            echo "Code Smells: $CODE_SMELLS"
            echo "Security Rating: $SECURITY_RATING"
            echo "Reliability Rating: $RELIABILITY_RATING"
            echo "Maintainability Rating: $MAINTAINABILITY_RATING"
        else
            echo "=== MÉTRICAS NO DISPONIBLES ==="
            echo "No se pudieron obtener métricas del servidor"
        fi
        
        echo ""
        echo "=== RESUMEN DE ISSUES ==="
        if [ -f "$REPORT_DIR/all-issues.json" ]; then
            TOTAL_ISSUES=$(jq '.total' "$REPORT_DIR/all-issues.json" 2>/dev/null || echo "0")
            echo "Total de issues: $TOTAL_ISSUES"
            
            # Contar por severidad
            echo "Por severidad:"
            jq -r '.issues[] | .severity' "$REPORT_DIR/all-issues.json" 2>/dev/null | sort | uniq -c | while read count severity; do
                echo "  $severity: $count"
            done
        fi
        
        echo ""
        echo "=== VULNERABILIDADES DE SEGURIDAD ==="
        if [ -f "$REPORT_DIR/vulnerabilities.json" ]; then
            VULN_COUNT=$(jq '.total' "$REPORT_DIR/vulnerabilities.json" 2>/dev/null || echo "0")
            echo "Total vulnerabilidades: $VULN_COUNT"
            
            if [ "$VULN_COUNT" != "0" ]; then
                echo "Detalle de vulnerabilidades:"
                jq -r '.issues[] | "  - \(.message) (Severidad: \(.severity), Archivo: \(.component))"' "$REPORT_DIR/vulnerabilities.json" 2>/dev/null | head -10
            fi
        fi
        
        echo ""
        echo "=== RECOMENDACIONES INMEDIATAS ==="
        echo "1. Revisar dashboard completo en: $SONAR_HOST/dashboard?id=$SONAR_PROJECT_KEY"
        echo "2. Verificar vulnerabilidades de seguridad: cat $REPORT_DIR/vulnerabilities.json"
        echo "3. Corregir bugs críticos: cat $REPORT_DIR/bugs.json"
        echo "4. Mejorar code smells: cat $REPORT_DIR/code-smells.json"
        echo "5. Revisar security hotspots: cat $REPORT_DIR/security-hotspots.json"
        echo ""
        echo "=== ARCHIVOS DE REPORTE GENERADOS ==="
        ls -la "$REPORT_DIR/" | grep -v "^d" | awk '{print "  " $9 " (" $5 " bytes)"}'
        echo ""
        echo "====================================================================="
        
    } > "$REPORT_DIR/executive-summary.txt"
    
    print_success "Resumen ejecutivo generado"
}

# Mostrar resultados
display_results() {
    print_header "RESULTADOS DEL ANÁLISIS SONARQUBE"
    
    echo -e "${CYAN}📁 Directorio de reportes:${NC} $REPORT_DIR"
    echo -e "${CYAN}🌐 Dashboard SonarQube:${NC} $SONAR_HOST/dashboard?id=$SONAR_PROJECT_KEY"
    echo ""
    
    # Mostrar resumen en pantalla
    if [ -f "$REPORT_DIR/executive-summary.txt" ]; then
        cat "$REPORT_DIR/executive-summary.txt"
    fi
    
    echo ""
    print_header "COMANDOS ÚTILES PARA REVISAR RESULTADOS"
    echo ""
    echo -e "${YELLOW}📊 Ver resumen completo:${NC}"
    echo "cat $REPORT_DIR/executive-summary.txt"
    echo ""
    echo -e "${YELLOW}🔍 Ver todas las métricas:${NC}"
    echo "jq '.' $REPORT_DIR/metrics.json"
    echo ""
    echo -e "${YELLOW}🐛 Ver bugs:${NC}"
    echo "jq '.issues[] | {message: .message, severity: .severity, file: .component}' $REPORT_DIR/bugs.json"
    echo ""
    echo -e "${YELLOW}🔒 Ver vulnerabilidades:${NC}"
    echo "jq '.issues[] | {message: .message, severity: .severity, file: .component}' $REPORT_DIR/vulnerabilities.json"
    echo ""
    echo -e "${YELLOW}🧹 Ver code smells:${NC}"
    echo "jq '.issues[] | {message: .message, severity: .severity, file: .component}' $REPORT_DIR/code-smells.json"
    echo ""
    echo -e "${YELLOW}🔥 Ver security hotspots:${NC}"
    echo "jq '.hotspots[] | {message: .message, status: .status, file: .component}' $REPORT_DIR/security-hotspots.json"
    echo ""
    echo -e "${YELLOW}📈 Ver métricas CSV:${NC}"
    echo "cat $REPORT_DIR/metrics.csv"
    echo ""
    echo -e "${YELLOW}🌐 Abrir dashboard web:${NC}"
    echo "firefox $SONAR_HOST/dashboard?id=$SONAR_PROJECT_KEY"
}

# Cleanup opcional
cleanup() {
    print_step "¿Quieres parar el servidor SonarQube? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        print_step "Parando SonarQube..."
        docker stop "$SONAR_CONTAINER_NAME" 2>/dev/null || true
        docker rm "$SONAR_CONTAINER_NAME" 2>/dev/null || true
        print_success "SonarQube parado"
    else
        print_success "SonarQube sigue corriendo en $SONAR_HOST"
    fi
}

# Función principal
main() {
    print_header "SONARQUBE ANALYSIS - BMW SERVICE MANAGER"
    echo -e "${CYAN}Iniciando análisis completo de código estático...${NC}"
    echo ""
    
    check_dependencies
    install_sonar_scanner
    setup_environment
    start_sonarqube
    setup_sonar_project
    create_sonar_config
    run_sonar_analysis
    get_project_metrics
    get_project_issues
    generate_reports
    analyze_bmw_specific
    generate_executive_summary
    display_results
    
    echo ""
    print_success "✅ ANÁLISIS SONARQUBE COMPLETO TERMINADO EXITOSAMENTE"
    echo -e "${GREEN}Dashboard disponible en: $SONAR_HOST/dashboard?id=$SONAR_PROJECT_KEY${NC}"
    echo -e "${GREEN}Reportes guardados en: $REPORT_DIR${NC}"
    
    cleanup
}

# Manejo de errores y señales
trap 'print_error "Script interrumpido"; docker stop $SONAR_CONTAINER_NAME 2>/dev/null || true; exit 1' INT TERM

# Ejecutar función principal
main "$@"