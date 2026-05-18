# Plataforma Web Plataforma IA Plataforma IA

Plataforma completa de evangelización de Inteligencia Artificial para Plataforma IA - Corporación Nacional del Cobre de Chile.

## 🎯 Descripción

Centro de Excelencia en Inteligencia Artificial diseñado para educar y capacitar a los empleados de Plataforma IA sobre el uso de IA en procesos mineros, con una experiencia moderna e interactiva que respeta completamente la identidad corporativa de Plataforma IA.

## ✨ Características Principales

### 📱 Páginas Implementadas

1. **Inicio**
   - Hero section con call-to-actions
   - Estadísticas en tiempo real (847 usuarios activos, 12 agentes, 2,340 horas ahorradas)
   - Preview de recursos con cards interactivas
   - Diseño responsive y accesible

2. **Aprende**
   - **Videos Educativos**: 6 videos con filtros por nivel (Básico, Intermedio, Avanzado)
   - **Diagramas Interactivos**: 3 diagramas expandibles (Agente vs Asistente, Flujo de Trabajo, Arquitectura)
   - **Mejores Prácticas**: DO's y DON'Ts, templates de prompts, casos de éxito
   - **Glosario**: Términos clave de IA aplicada a minería

3. **Catálogo de Agentes**
   - 12 agentes especializados en diferentes áreas mineras
   - Filtros por búsqueda, departamento y estado
   - Cards interactivas con información detallada
   - Modal de detalles con casos de uso

4. **Chat IA**
   - Asistente conversacional contextual
   - Respuestas inteligentes sobre agentes y mejores prácticas
   - Quick actions para consultas frecuentes
   - Interfaz tipo mensajería moderna

5. **Dashboard de Métricas**
   - 4 KPIs principales con tendencias
   - 6 gráficos interactivos usando Recharts:
     - Usuarios activos mensuales (línea)
     - Top 5 agentes más usados (barras)
     - Adopción por división (donut)
     - Usuarios nuevos vs recurrentes (área)
   - Filtros por división y rango de fechas
   - Exportación de reportes

6. **Recursos y Soporte**
   - FAQ con 6 preguntas frecuentes expandibles
   - Formulario de contacto completo con validación
   - Suscripción a newsletter
   - Información de contacto rápida

## 🎨 Identidad Visual Plataforma IA

### Colores Corporativos

**Primarios:**
- Naranja Corporativo: `#E55302` (Pantone 166C)
- Amarillo: `#F4AA00` (Pantone 130C)
- Turquesa: `#0098AA` (Pantone 320C)
- Rojo: `#C13832` (Pantone 180C)

**Secundarios:**
- Rojo Oscuro: `#7A2531`
- Gris Oscuro: `#36424A`
- Beige: `#C4C1A0`
- Verde Oscuro: `#106470`
- Azul: `#0072B1`

### Tipografías

- **Títulos**: Montserrat (sustituto de Centrale Sans)
- **Cuerpo**: Roboto
- Cargadas desde Google Fonts

## 🛠️ Tecnologías Utilizadas

- **Frontend Framework**: React 18.3 + TypeScript
- **Build Tool**: Vite 5.1
- **Estilos**: Tailwind CSS 3.4
- **Routing**: React Router DOM 6.22
- **Gráficos**: Recharts 2.12
- **Iconos**: Lucide React 0.344

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js 18+
- npm o yarn

### Pasos de Instalación

1. **Clonar o ubicarse en el directorio del proyecto**
```bash
cd plataforma-ia-front
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Iniciar servidor de desarrollo**
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### Scripts Disponibles

```bash
npm run dev      # Inicia servidor de desarrollo
npm run build    # Compila para producción
npm run preview  # Previsualiza build de producción
npm run lint     # Ejecuta linter
```

## 📁 Estructura del Proyecto

```
src/
├── components/          # Componentes reutilizables
│   ├── Navbar.tsx      # Barra de navegación
│   ├── Footer.tsx      # Pie de página
│   └── Layout.tsx      # Layout principal
├── pages/              # Páginas de la aplicación
│   ├── HomePage.tsx
│   ├── LearnPage.tsx
│   ├── AgentsPage.tsx
│   ├── ChatPage.tsx
│   ├── DashboardPage.tsx
│   └── ResourcesPage.tsx
├── types/              # Tipos TypeScript
│   └── index.ts
├── data/               # Datos mock
│   └── mockData.ts
├── App.tsx             # Componente principal
├── main.tsx            # Punto de entrada
└── index.css           # Estilos globales
```

## 🎯 Agentes IA Incluidos

1. **CopperData AI** - Análisis predictivo de producción
2. **MineCode Assistant** - Asistente de programación para automatización
3. **SafetyIQ** - Análisis de riesgos y prevención
4. **DocuCopper** - Generación de reportes técnicos
5. **MaintenanceAI** - Predicción de mantenciones
6. **GeoAnalytics** - Análisis geológico con IA
7. **EnergyOptimizer** - Optimización energética
8. **TalentMatch** - Matching de talento
9. **SupplyChainAI** - Optimización de cadena de suministro
10. **QualityVision** - Inspección visual automatizada
11. **FinanceIQ** - Análisis financiero predictivo
12. **EnvironmentGuard** - Monitoreo ambiental

## ♿ Accesibilidad

La plataforma cumple con estándares WCAG AA:

- Contraste de colores adecuado
- Textos legibles (mínimo 16px)
- Áreas clickeables mínimas de 44x44px
- Labels apropiados en formularios
- Navegación por teclado funcional
- Responsive design (mobile first)

## 📱 Responsive Design

Breakpoints configurados:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## 🔧 Configuración de Tailwind

Los colores corporativos de Plataforma IA están configurados en `tailwind.config.js`:

```javascript
colors: {
  plataforma-ia: {
    naranja: '#E55302',
    amarillo: '#F4AA00',
    turquesa: '#0098AA',
    // ... más colores
  }
}
```

Uso en componentes:
```jsx
<div className="bg-plataforma-naranja text-white">
  Contenido
</div>
```

## 📊 Datos y Métricas

Actualmente la aplicación utiliza datos mock realistas en `src/data/mockData.ts`. Para conectar con APIs reales:

1. Crear servicios en `src/services/`
2. Implementar hooks personalizados en `src/hooks/`
3. Actualizar componentes para usar datos reales

## 🚀 Despliegue

### Compilar para Producción

```bash
npm run build
```

Esto genera la carpeta `dist/` lista para desplegar.

### Opciones de Despliegue

- **Vercel**: `vercel deploy`
- **Netlify**: Conectar repositorio o usar CLI
- **AWS S3 + CloudFront**: Subir contenido de `dist/`
- **Servidor propio**: Servir archivos estáticos de `dist/`

## 🎓 Uso de la Plataforma

### Para Empleados

1. **Explorar Agentes**: Navega a `/agentes` para ver todos los agentes disponibles
2. **Aprender**: Accede a `/aprende` para videos y mejores prácticas
3. **Probar Chat**: Usa `/chat` para consultas en tiempo real
4. **Ver Métricas**: Dashboard en `/dashboard` muestra adopción

### Para Gerencia

1. Activa "Vista Gerencial" en el Dashboard
2. Exporta reportes usando el botón "Exportar Reporte"
3. Filtra por división para métricas específicas

## 🤝 Contribuir

Para proponer mejoras:

1. Usa el formulario de contacto en `/recursos`
2. Envía email a `contacto@plataforma-ia.example`
3. Selecciona "Propuesta de Nuevo Agente" o "Feedback o Sugerencia"

## 📝 Licencia

© 2024 Plataforma IA - Corporación Nacional del Cobre de Chile. Todos los derechos reservados.

## 📞 Soporte

- **Email**: contacto@plataforma-ia.example
- **Teléfono**: +56 2 2690 3000
- **Ubicación**: Huérfanos 1270, Santiago, Chile

---

**Desarrollado con** ❤️ **para la transformación digital de Plataforma IA**
