# Plataforma IA - Backend

Backend API para el chat conversacional de la Plataforma IA de Plataforma IA, construido con FastAPI y Azure AI Foundry.

## 🚀 Inicio Rápido

**¿Primera vez aquí?** Lee la guía de inicio rápido: **[QUICK_START.md](./QUICK_START.md)** (15 minutos)

## 📚 Documentación

| Documento | Descripción | Cuándo usar |
|-----------|-------------|-------------|
| **[QUICK_START.md](./QUICK_START.md)** | Guía de inicio rápido (15 min) | Primera vez configurando el proyecto |
| **[AZURE_FOUNDRY_SETUP.md](./AZURE_FOUNDRY_SETUP.md)** | Guía completa de Azure AI Foundry | Configurar Azure, deployments, troubleshooting |
| **[TOOLS_GUIDE.md](./TOOLS_GUIDE.md)** | Crear y usar herramientas del agente | Agregar nuevas capacidades al agente |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Arquitectura del sistema | Entender cómo funciona todo el sistema |
| **[SETUP.md](./SETUP.md)** | Configuración detallada | Configuración avanzada del proyecto |

## Características

- ✅ API REST y WebSocket para chat en tiempo real
- ✅ Integración con Azure AI Foundry (modelos Claude)
- ✅ Sistema de agentes extensible
- ✅ Tool Calling - Agente puede usar herramientas (Excel, etc.)
- ✅ Streaming de respuestas
- ✅ Historial de conversaciones
- ✅ CORS configurado para frontend React

## Requisitos

- Python 3.9+
- Cuenta de Azure con acceso a Azure AI Foundry
- Credenciales de Azure AI Projects

**📘 ¿Primera vez usando Azure AI Foundry?** Lee la guía completa: [AZURE_FOUNDRY_SETUP.md](./AZURE_FOUNDRY_SETUP.md)

## Instalación

1. Crear entorno virtual:
```bash
python -m venv venv
```

2. Activar entorno virtual:
```bash
# Windows PowerShell
.\venv\Scripts\Activate.ps1

# Windows CMD
.\venv\Scripts\activate.bat

# Linux/Mac
source venv/bin/activate
```

3. Instalar dependencias:
```bash
pip install -r requirements.txt
```

4. Configurar variables de entorno:
```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tus credenciales reales
```

## Configuración

### Guía Rápida

Edita el archivo `.env` con tus credenciales de Azure AI Foundry:

```bash
# 1. Base URL del proyecto (formato Anthropic)
ANTHROPIC_BASE_URL=https://tu-proyecto.eastus.api.azureml.ms/models/anthropic/chat/completions

# 2. API Key de Azure AI Foundry
ANTHROPIC_API_KEY=tu-api-key-aqui

# 3. Modelo desplegado
CHAT_MODEL=claude-sonnet-4-5
```

### Dónde obtener las credenciales:

1. **Base URL**: https://ai.azure.com → Tu Proyecto → Settings → Endpoints
2. **API Key**: https://ai.azure.com → Tu Proyecto → Settings → API Keys
3. **Modelo**: Nombre del deployment creado en Deployments

**📘 Guía detallada paso a paso:** [AZURE_FOUNDRY_SETUP.md](./AZURE_FOUNDRY_SETUP.md)

## Uso

Iniciar el servidor de desarrollo:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

La API estará disponible en `http://localhost:8000`

## Documentación API

Una vez iniciado el servidor, visita:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Estructura del Proyecto

```
plataforma-ia-back/
├── app/
│   ├── config/          # Configuración y variables de entorno
│   ├── models/          # Modelos Pydantic
│   ├── services/        # Lógica de negocio
│   ├── agents/          # Sistema de agentes
│   └── routers/         # Endpoints de la API
├── requirements.txt     # Dependencias
├── .env                 # Variables de entorno (no commitear)
└── README.md
```

## Herramientas del Agente

El agente ahora tiene capacidades de **Tool Calling** que le permiten:

- **Guardar información en Excel**: El agente puede guardar datos recopilados en archivos Excel automáticamente
- **Agregar datos incrementalmente**: Puede ir agregando información a archivos existentes
- **Leer archivos Excel**: Puede consultar información previamente guardada

### Ejemplo de uso:

```
Usuario: "Recopila información sobre la producción de hoy y guárdala en Excel"
Agente: *Recopila los datos y automáticamente los guarda en Excel*
```

Para más detalles, consulta [TOOLS_GUIDE.md](./TOOLS_GUIDE.md)

### Probar las herramientas:

```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar tests de herramientas
python test_tools.py
```

Los archivos generados se guardan en la carpeta `output/`.

## Desarrollo

Este proyecto está en desarrollo activo. Características implementadas:
- ✅ Sistema de herramientas para agentes (Excel)
- ✅ Historial de conversaciones en memoria
- ✅ Tool Calling con Anthropic SDK

Próximas características:
- Múltiples agentes especializados
- Herramientas adicionales (email, base de datos, gráficos)
- Métricas y monitoreo
- Persistencia de conversaciones en base de datos
