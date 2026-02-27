# Análisis y Plan Integral de Mejoras: Anclora Advisor AI

Tras analizar tu documento [Plan_de_Mejoras_RAG.md](file:///c:/Users/Usuario/Workspace/01_Proyectos/anclora-advisor-ai/docs/Plan_de_Mejoras_RAG.md) y tomando en consideración las altas capacidades de tu hardware (LG gram Pro equipado con **Intel Core Ultra 7 con NPU**, 32GB LPDDR5x y **NVIDIA RTX 3050**), presento mi revisión profesional orientada a maximizar el rendimiento mediante tecnologías Open Source.

---

## 1. Análisis del Documento Actual ([Plan_de_Mejoras_RAG.md](file:///c:/Users/Usuario/Workspace/01_Proyectos/anclora-advisor-ai/docs/Plan_de_Mejoras_RAG.md))

### 🛠️ Qué Mejoraría
**Distribución de VRAM/RAM y Cuantización (Punto 1.2 y 1.3):**
*   **Motivación:** El documento asume cargar partes críticas en la RTX 3050 y el resto en RAM. La RTX 3050 de portátil suele tener 4GB de VRAM. Un modelo Qwen 2.5 14B en `Q4_K_M` pesa unos ~8.5GB. Intentar usar un `Q6_K` (que roza los 11.5GB) ralentizará asimétricamente la generación debido a los constantes saltos entre la VRAM y la RAM del sistema.
*   **Mejora:** Establecer estrictamente la cuantización **`Q4_K_M` para modelos de 14B** y delegar en Ollama la gestión de memoria. Ollama detectará la VRAM e inherentemente saturará la NVIDIA `cuda`, dejando el desbordamiento a los rápidos 32GB de LPDDR5x. Es el balance perfecto entre precisión semántica-legal y rendimiento.

### ❌ Qué Quitaría
**Sustitución de Ollama por ipex-llm como motor principal (Punto 1.1):**
*   **Motivación:** `ipex-llm` (Intel Extension for PyTorch) es brillante para sistemas *100% Intel* (iGPU/NPU). Sin embargo, la arquitectura de tu LG Gram cuenta con una potente **GPU dedicada de NVIDIA (RTX 3050)**. Las arquitecturas basadas en CUDA son el estándar insuperable en inferencia rápida con Ollama/llama.cpp.
*   **Decisión:** Eliminaría la recomendación de sustituir el motor LLM principal por `ipex-llm`. Es vital **mantener Ollama con el framework NVIDIA habilitado** para el procesamiento pesado de texto, preservando así la potencia geométrica y de tensor cores de la RTX 3050.

### ➕ Qué Añadiría
1.  **Semantic Chunking (Fragmentación Semántica):**
    *   **Motivación:** El documento propone un chunking "Contextual" por estructura (artículos/títulos). Añadiría dividir basado en significado. Las leyes a veces mezclan varios supuestos técnicos largos en un mismo párrafo.
    *   **Adición:** Cortar dinámicamente cuando el significado semántico cambia, lo cual eleva muchísimo el recall en la recuperación vectorial en casos prácticos ("¿qué hago si...?").
2.  **Reranker y Embeddings nativos exclusivamente en el NPU:**
    *   **Motivación:** Al dejar la NVIDIA para el LLM, necesitamos hardware sin cuellos de botella para el buscador neuronal. Aquí es donde brilla tu NPU de Intel Core Ultra.
    *   **Adición:** Implementar de forma explícita modelos pequeños (como `bge-m3` o `jina-reranker-multilingual`) compilados en **OpenVINO u Optimum-Intel**. Al derivar esto al NPU, liberas el sistema base, reduces consumo térmico e incrementas fluidez, construyendo un verdadero pipeline de IA heterogénea.
3.  **Framework de Monitoreo RAG (RAGAS / TruLens):**
    *   **Motivación:** Al ser un asistente legal/fiscal, las alucinaciones pueden ser letales. El plan asume mejora al cambiar el modelo pero no explica cómo se medirá.
    *   **Adición:** Añadir un sistema analítico de métricas Open Source para evaluar sistemáticamente la Recisión del Contexto, la Fidelidad y la Relevancia de la respuesta automatizada antes de pasarlo a producción con usuarios reales.

---

## 2. Plan Integral de Mejoras de Aplicación (Anclora Advisor AI)

A continuación, un plan de acción para el sistema completo, agrupado por orden de prioridad para construir un producto sólido, escalable y eficiente *self-hosted*.

### 🔴 Prioridad 1: Core de Inteligencia Artificial (El Motor Semántico y Técnico)
*Asegurar que las respuestas y la lógica técnica fluyan exactas, apoyadas en arquitectura pesada.*

1.  **Arquitectura Heterogénea de Hardware a Nivel Máquina:**
    *   **Ollama sobre RTX 3050 (Primary):** Generación de tokens y comprensión de consultas.
    *   **OpenVINO sobre Intel NPU/iGPU (Background):** Pipeline independiente exclusivo para el procesamiento del *Retrieval* e inyección (Embeddings vectoriales) y *Re-ranking*, utilizando librerías nativas de aceleración Intel.
2.  **Delegación "Tool Calling" Estricta (Erradicación de Alucinación Matemática):**
    *   Prohibir a los LLM (mediante prompts de sistema) realizar operaciones aritméticas sobre cuotas o devoluciones del IVA/IRPF.
    *   Implementar rutinas puras en TypeScript que efectúen el cálculo, donde el LLM sólo ejecuta un *"Llamado a Función"* pasando los hiperparámetros detectados.
3.  **Hybrid Search Local Integrado con RRF (Reciprocal Rank Fusion):**
    *   Desplegar búsquedas complejas en la DB conectando `pgvector` (similitud semántica de dudas difusas) con *Full-Text Search BM25* (para términos exactos como "RD 1619/2012"). Combinar ambas puntuaciones mediante un motor RRF optimizado.

### 🟠 Prioridad 2: Soporte Estructural, Backend y Seguridad de Datos
*Transformar el prototipo de IA en una plataforma "Enterprise-Grade" resistente e inmutable.*

1.  **Row Level Security (RLS) Mandatorio en Todo el Scope:**
    *   Toda tabla creada en Supabase (`chats`, `labor_risk_assessments`, `invoices`, `rag_history`) debe requerir el `auth.uid()` del JWT. La política de seguridad aísla herméticamente los datos financieros y jurídicos (Multitenancy puro).
2.  **Sistema de Gobernanza RBAC (Role-Based Access Control):**
    *   Extender el sistema de autenticación para admitir campos escalares en perfiles `role = admin | partner | user`. Rutas y endpoints que afecten a la memoria del RAG, reingestas o parametrizaciones globales deben quedar fortificadas, validadas a del nivel SSR en Next.js.
3.  **Circuit Breakers y Rate Limiting Local:**
    *   Limitar las colas de peticiones. Debido a que el LLM se ejecuta local, el backend debe poner en 'Hold' o rechazar peticiones abusivas que puedan reventar el pool térmico de la terminal o encolar la memoria.

### 🟡 Prioridad 3: UX y Features de Negocio de la "Advisor AI"
*Las interfaces de cara al cliente y asistentes integrados de productividad.*

1.  **Citas Bibliográficas Predictivas y Visuales (UI Contextual):**
    *   Garantizar que en la interfaz, el Assistant Chat retorne siempre "Citas accionables". Al pasar el cursor por un bloque citado de una respuesta de riesgo, renderizar *Popovers* que expongan exactamente el extracto legal de los cuadernos originales consumidos en la inyección (Cumpliendo Feature `ANCLORA-CHAT-002`).
2.  **Predictividad en Facturación e IRPF (Autofill AI):**
    *   Al intentar crear facturas o rellenar el Panel Fiscal, la inteligencia debe ser subrepticia (por detrás). Un modelo minúsculo observando variables `onBlur` que sugiera autocompletados (ej. aplicar exenciones formativas automáticamente) para agilizar operativas.
3.  **Dashboard de Riesgos y Alertas Activas:**
    *   Cambiar de "Modo Conversación Recreativo" a "Modo Asesor Proactivo". Cronjobs internos comparan las fechas de entregas impositivas vs. perfiles de usuario, incrustando Cards de acción de emergencia en el Home del Dashboard directamente de la base central.

### 🟢 Prioridad 4: Observabilidad, DevOps y Experiencia de Desarrollo
*Asegurar que se puede hacer crecer y depurar los fallos.*

1.  **Streaming Nativo Completo (UI Dinámica):**
    *   El usuario jamás espera pantallas de "Cargando...". Implementación directa del **Vercel AI SDK** en conjunto con la API para mandar fragmentos SSE (*Server Sent Events*), imprimiendo la asesoría en tiempo real.
2.  **Adoptar Observabilidad RAG Open Source Centralizada:**
    *   Integrar un contenedor de [Langfuse](https://langfuse.com) y trazar todas las ejecuciones internamente. Podrás ver tiempos de latencia milisegundo a milisegundo, estimaciones de "costo simbólico", rastrear tokens consumidos por iteración y capturar likes/dislikes del cliente nativamente, todo 100% privado en tu ordenador.
3.  **Testing Suites "Smoke & Contracts":**
    *   Introducir robustez vía Playwright / Vitest para testear E2E que las calculadoras puras funcionen, que el SSR rechace a no autorizados y que la firma de datos de las interacciones JSON con la IA siempre siga el contrato. Un código sin regresiones.
