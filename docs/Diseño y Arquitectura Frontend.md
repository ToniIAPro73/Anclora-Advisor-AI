# **DISEÑO ARQUITECTÓNICO Y UI/UX: ANCLORA ADVISOR AI**

Este documento establece los estándares de diseño, la estructura de navegación y la arquitectura de componentes para el frontend de la aplicación. El objetivo es garantizar una experiencia de usuario (UX) premium, alineada con la marca Anclora Private Estates, orientada a la eficiencia y el control de la pluriactividad.

## **1\. SISTEMA DE DISEÑO (DESIGN SYSTEM)**

Aplica las siguientes directrices visuales mediante Tailwind CSS en toda la aplicación para proyectar autoridad, lujo y precisión técnica.

* **Paleta de Colores:**  
  * **Primario (Fondo oscuro/Nav):** slate-900 (\#0f172a) \- Proyecta solidez corporativa y exclusividad.  
  * **Acento (Llamadas a la acción/Destacados):** amber-400 (\#fbbf24) a amber-500 (\#f59e0b) \- Aporta el toque de lujo (dorado) para botones e iconos.  
  * **Fondos principales:** gray-50 (\#f9fafb) para el lienzo del dashboard, garantizando legibilidad en largas sesiones.  
  * **Alertas Semánticas:** \* Crítico/Riesgo Laboral: red-600 (\#dc2626).  
    * Advertencia Fiscal: orange-500 (\#f97316).  
    * Éxito/Cumplimiento: emerald-600 (\#059669).  
* **Tipografía:**  
  * Utiliza Inter para la interfaz general (UI, menús, botones) por su alta legibilidad técnica.  
  * Utiliza Playfair Display (opcional) para títulos principales (H1) si deseas acentuar el aspecto editorial de lujo.  
* **Geometría UI:**  
  * Usa bordes redondeados medios (rounded-lg o rounded-xl) para tarjetas y paneles.  
  * Aplica sombras sutiles (shadow-sm, shadow-md) para separar los contenedores de contenido del fondo.

## **2\. ARQUITECTURA DE RUTAS (NEXT.JS 15 APP ROUTER)**

Implementa la siguiente estructura de directorios dentro de src/app para organizar la navegación y proteger las rutas.

* / (Raíz): Redirige automáticamente a /login o /dashboard según el estado de la sesión.  
* /login: Interfaz de autenticación (Login / Registro).  
* /dashboard: **(Ruta Protegida \- Layout Principal)**  
  * /dashboard/chat: Interfaz principal de consulta (RAG Orchestrator).  
  * /dashboard/fiscal: Panel de alertas fiscales, plazos de IVA/IRPF y seguimiento de la Cuota Cero.  
  * /dashboard/laboral: Monitor de cumplimiento de pluriactividad y evaluación de riesgos de despido.  
  * /dashboard/facturacion: Módulo de generación de facturas con cálculo automático de retenciones.

## **3\. FLUJO DE AUTENTICACIÓN (SUPABASE AUTH)**

La seguridad se gestionará íntegramente de forma nativa con Supabase. Implementa el siguiente flujo lógico:

1. **Middleware de Next.js (src/middleware.ts):** \* Intercepta todas las peticiones a /dashboard/\*.  
   * Verifica la existencia de un token de sesión válido de Supabase.  
   * Si no hay sesión, redirige al usuario a /login.  
2. **Página de Login (src/app/login/page.tsx):**  
   * Formulario minimalista para acceso mediante Email y Contraseña (Magic Link opcional).  
   * Una vez autenticado, Supabase inyecta la cookie de sesión y el usuario es redirigido a /dashboard.  
3. **RLS (Row Level Security):**  
   * Las políticas SQL ya creadas garantizan que, aunque la API sea accesible, el usuario autenticado solo pueda leer/escribir registros en conversations, fiscal\_alerts e invoices donde user\_id \== auth.uid().

## **4\. COMPONENTES CLAVE DEL DASHBOARD**

Desarrolla la interfaz del Dashboard combinando los siguientes componentes modulares:

### **4.1. Layout del Dashboard (DashboardLayout)**

* **Sidebar Fijo (Izquierda):** Menú de navegación vertical con fondo slate-900. Contiene el logo de "Anclora Advisor", enlaces a las secciones (Chat, Fiscal, Laboral, Facturación) con iconos de lucide-react, y el botón de "Cerrar Sesión" en la parte inferior.  
* **Top Bar (Superior):** Barra limpia que muestra la sección actual (Ej. "Asesoría RAG") y el perfil del usuario activo.  
* **Main Content (Centro/Derecha):** Lienzo con fondo gray-50 donde se inyectan las vistas de página (children).

### **4.2. Vista Principal: Chat RAG (ChatInterface)**

* **Área de Mensajes:** Lista conversacional donde los mensajes del usuario aparecen a la derecha (fondo azul/dorado) y las respuestas del Orchestrator a la izquierda (fondo blanco, sombra sutil).  
* **Citas y Fuentes:** Cada respuesta del IA debe incluir un bloque desplegable debajo que muestre el documento normativo o cuaderno de posicionamiento del que extrajo la información.  
* **Alertas Integradas:** Si el Orchestrator devuelve un aviso crítico (ej. "Riesgo de transgresión de buena fe"), el chat debe inyectar una tarjeta roja destacada interrumpiendo el flujo normal.

### **4.3. Vista Fiscal (FiscalPanel)**

* **Widget de Cuota Cero:** Un bloque visual (indicador de progreso) que muestra el estado de la bonificación (Año 1 o Año 2\) en Baleares.  
* **Línea de Tiempo (Timeline) de Impuestos:** Tarjetas ordenadas por fecha de vencimiento (due\_date) que avisen de la presentación del Modelo 303 (IVA) y 130 (IRPF).

### **4.4. Vista Laboral (LaborRiskMonitor)**

* **Risk Score (Medidor de Riesgo):** Gráfico circular o barra de progreso (de 0.00 a 1.00) que indica el nivel actual de riesgo de incurrir en competencia desleal o violación del pacto de exclusividad con CGI.  
* **Registro de Evaluaciones:** Historial de las consultas pasadas relacionadas con el ámbito laboral y las recomendaciones dictaminadas por el sistema RAG.

## **5\. SECUENCIA DE IMPLEMENTACIÓN RECOMENDADA**

Para materializar este diseño, instruye la generación del código en el siguiente orden estricto:

1. **Fase A:** Middleware de Supabase y pantalla de autenticación (/login).  
2. **Fase B:** Estructura global del Dashboard (Sidebar, Topbar, Layout).  
3. **Fase C:** Integración del componente ChatInterface (previamente generado) dentro de la vista principal del dashboard.  
4. **Fase D:** Pantallas secundarias (Fiscal y Laboral).