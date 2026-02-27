# **Plan de Optimización RAG: Anclora Advisor AI**

Este documento detalla la estrategia para maximizar el rendimiento del sistema de asesoría utilizando LLMs locales y hardware Intel de última generación, incluyendo la gestión administrativa de datos.

## **1\. Optimización de Inferencia y Hardware (Aceleración Intel)**

Tu equipo cuenta con un NPU (Neural Processing Unit) y una gráfica RTX 3050\. La configuración actual de Ollama tiende a priorizar CPU/GPU de forma genérica.

### **Acciones Recomendadas:**

1. **Migración a ipex-llm (Intel Extension for PyTorch):**  
   * **Propósito:** Permite ejecutar modelos en el NPU e iGPU de Intel con latencias mucho menores que la ejecución pura en CPU.  
   * **Implementación:** Sustituir o complementar Ollama con un backend basado en ipex-llm para el modelo de fallback o tareas de fondo (como sumerización de documentos).  
2. **Cuantización Selectiva:**  
   * Para **Qwen2.5 14b**: Utilizar cuantización Q4\_K\_M o Q5\_K\_M. Con 32GB de RAM, puedes permitirte un Q6\_K para mayor precisión en leyes fiscales, cargando las capas críticas en la VRAM de la RTX 3050 (4GB) y el resto en la RAM del sistema (LPDDR5x).  
3. **Aislamiento de Cargas:**  
   * Destinar la **RTX 3050** exclusivamente para la generación de texto (LLM Primary).  
   * Utilizar el **NPU/iGPU** mediante OpenVINO para el modelo de embeddings y el re-ranker.

## **2\. Mejora de la Calidad del RAG (Precisión de Asesoría)**

La asesoría fiscal requiere exactitud terminológica. El modelo all-minilm es rápido pero carece de matices para el lenguaje legal complejo en español.

### **Acciones Recomendadas:**

1. **Cambio de Modelo de Embedding:**  
   * **Recomendación:** BAAI/bge-m3 o intfloat/multilingual-e5-large.  
   * **Beneficio:** Estos modelos manejan mucho mejor las relaciones semánticas en español y permiten búsquedas multilingües si consultas fuentes de la UE.  
2. **Implementación de Hybrid Search (Búsqueda Híbrida):**  
   * **Técnica:** Combinar búsqueda vectorial (semántica) con búsqueda BM25 (palabras clave).  
   * **Beneficio:** Crítico para encontrar artículos específicos de leyes (ej. "Artículo 31 LETA") donde la semántica puede ser ambigua pero la palabra clave es exacta.  
3. **Introducción de un Re-Ranker Local:**  
   * **Modelo:** bge-reranker-v2-m3.  
   * **Flujo:** Recuperar 20 documentos con el RAG y usar el re-ranker para seleccionar los 5 más relevantes antes de enviarlos al LLM. Esto reduce drásticamente las alucinaciones fiscales.

## **3\. Estructura de Datos para Autónomos (Pluriactividad)**

El contexto de pluriactividad implica cruzar datos de dos regímenes (General y RETA).

### **Acciones Recomendadas:**

1. **Metadata Filtering:**  
   * Etiquetar cada documento en Supabase con metadatos específicos: regimen: "RETA", ambito: "fiscal", fuente: "BOE".  
   * El orquestador debe filtrar por metadatos según la intención detectada en la consulta.  
2. **Contextual Chunking:**  
   * En lugar de trozos de texto fijos, usar un sistema de partición que respete la jerarquía de los documentos legales (Títulos, Capítulos, Artículos).

## **4\. Orquestación y Agentes**

Tu archivo lib/agents/orchestrator.ts debe evolucionar hacia un modelo de "Plan-and-Solve".

### **Acciones Recomendadas:**

1. **Agente Verificador de Normativa:**  
   * Antes de responder, un segundo paso de inferencia (usando el modelo de fallback Llama3.1:8b) debe verificar si la respuesta del modelo primario contradice los documentos recuperados.  
2. **Cálculo Asistido por Herramientas:**  
   * No permitas que el LLM calcule cuotas de autónomos o IRPF directamente. Implementa funciones (Tools) de TypeScript que realicen los cálculos matemáticos y deja que el LLM solo suministre los parámetros.

## **5\. Panel de Administración de Ingesta (Exclusivo)**

Para mantener la integridad de la base de conocimientos, se implementará un flujo de alimentación restringido.

### **Acciones Recomendadas:**

1. **Gobernanza RBAC (Role-Based Access Control):**  
   * **Implementación:** Añadir una columna role en la tabla profiles de Supabase.  
   * **Restricción:** Solo los usuarios con role \= 'admin' podrán acceder a la ruta /dashboard/admin/ingesta.  
   * **Seguridad:** Las API Routes de ingesta (basadas en scripts/ingest-rag.ts) deben validar el JWT del servidor para confirmar el rol de administrador antes de procesar cualquier archivo.  
2. **Interfaz de Gestión de Conocimiento:**  
   * **Área de Carga:** Dropzone para PDFs de leyes, circulares de la AEAT o convenios laborales.  
   * **Monitor de Proceso:** Visualización en tiempo real del progreso de embeddings (usando WebSockets o Server-Sent Events desde el servidor local).  
   * **Sincronización Manual:** Botón para disparar la sincronización con NotebookLM (si se detectan cambios en el bundle externo).  
3. **Validación de Datos Ingeridos:**  
   * Implementar una vista de "Documentos Indexados" donde el administrador pueda corregir metadatos manualmente o eliminar fragmentos obsoletos del índice vectorial.

## **6\. Próximos Pasos Técnicos**

1. **Actualizar scripts/ingest-rag.ts** para incluir el modelo bge-m3 y soporte para metadatos.  
2. **Configurar API Route Segura** en src/app/api/admin/ingest/route.ts con validación de rol.  
3. **Desarrollar la vista de Admin** utilizando componentes de Shadcn UI para la gestión de archivos y logs de ingesta.