# Integración con Copilot Studio — Dependencias bloqueadas

Documento para escalar al equipo de identidad y networking de Plataforma IA antes de implementar la conexión del dashboard con métricas de agentes Copilot Studio.

## Objetivo

Traer al dashboard del proyecto Plataforma IA las métricas de uso (sesiones, usuarios únicos, CSAT, tasa de resolución) de los agentes de negocio que viven en **Copilot Studio** (Power Platform) del tenant Plataforma IA (`00000000-0000-0000-0000-000000000000`).

## Estado actual (2026-04-22)

- Cero integración en el backend. Ni un solo import o llamada a `api.bap.microsoft.com`, `api.powerplatform.com` o Dataverse relacionada con métricas.
- Los bots en la suscripción `Subscripcion GAN` que aparecen como `Microsoft.BotService` (`agent-bot33798`, `analista-datos-mercado43457`, `test2-dmh-control-gesti-n09748`) son **Azure Bot Service**, no Copilot Studio.
- El dashboard hoy muestra tokens de Azure AI Foundry y actividad interna (Cosmos DB). Nada de Copilot Studio.

## Dependencias a resolver antes de codear

### 1. App Registration en Entra ID

- Nombre sugerido: `sp-plataformaia-copilot-reader`
- Tenant: `00000000-0000-0000-0000-000000000000` (Plataforma IA)
- Quién lo puede crear: usuario con rol **Cloud Application Administrator** o **Global Admin**. `JTAPI096.CLOUD@plataforma-ia.example` no lo tiene.
- API permissions (tipo **Application**, no delegated):
  - `Power Platform API` → `AppManagement.ApplicationPackages.Read`
  - `Power Platform API` → `Analytics.Read`
  - (opcional) `Microsoft Graph` → `Directory.Read.All`
- Consentimiento de admin requerido para todas.
- Una vez creado, guardar `client_id` y el **secret** en Key Vault:
  - Dev: `kv-plataformaia-dev` → secretos `pplat-client-id` y `pplat-client-secret`
  - Test: `kv-plataformaia-test`
  - Prod: `kv-plataformaia-prod`

### 2. Acceso de red al endpoint Power Platform

- Endpoint: `https://api.bap.microsoft.com` y `https://*.api.bap.microsoft.com` (regional).
- Desde la laptop de Jorge (red corporativa Plataforma IA) **NO resuelve DNS** — el firewall lo bloquea.
- El backend corre en Azure (Container Apps o App Service en `rg-plataformaia-dev`): debe validarse que el egress permite resolver esos hostnames. Si Plataforma IA tiene reglas de egress explícitas, agregar los dominios a la whitelist.

### 3. Inventario de agentes Copilot Studio a reflejar

Jorge, necesitamos que el equipo de Copilot Studio / Power Platform provea:

| Campo | Valor | Notas |
|---|---|---|
| Environment ID | (uuid) | Uno o más entornos Power Platform que contengan los copilots de negocio |
| Environment region | p. ej. `southamerica` | Define el hostname regional del API |
| Nombres de copilots | lista | Nombre visible + ID interno |
| Alcance de métricas | — | ¿Todos los agentes del tenant o solo los "de negocio"? |

Sin esta info no podemos discriminar qué bots del tenant (desarrollos, tests personales, bots privados de otras áreas) deben aparecer en el dashboard.

### 4. Permisos de usuario para el discovery inicial

Para poder hacer `az rest --method get --url https://api.bap.microsoft.com/...` el usuario necesita **Power Platform Administrator** a nivel tenant. Si el rol no se puede conceder, alternativa: que el equipo de Power Platform ejecute el discovery y nos envíe los IDs.

## Una vez desbloqueado — implementación mínima

Archivos a crear/tocar (diseño ya validado):

- `app/services/copilot_studio_service.py` (nuevo) — MSAL `ConfidentialClientApplication` con scope `https://api.powerplatform.com/.default`. Funciones `list_copilots()` y `get_copilot_analytics(copilot_id, days)`.
- `app/routers/stats.py` — merge del resultado bajo key `copilot_studio` en `/stats/`.
- `app/services/statsApi.ts` + `DashboardPage.tsx` — nueva sección "Agentes Copilot Studio" con tabla (nombre · sesiones · CSAT · usuarios únicos).
- `.env.example` — `PPLAT_CLIENT_ID`, `PPLAT_CLIENT_SECRET_KV_NAME`, `PPLAT_ENVIRONMENT_IDS`.

Patrón a seguir: el mismo de `azure_monitor_service.py` (caché 5 min, degradación a dict vacío si la llamada falla para no romper el dashboard).

## A quién escalar

- **Identity / Entra admin**: App Registration con permissions de Power Platform API.
- **Networking**: egress del backend a `api.bap.microsoft.com`.
- **Power Platform admin (Copilot Studio)**: inventario de environments y copilots a medir.
