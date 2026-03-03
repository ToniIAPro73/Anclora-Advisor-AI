# **Estrategia de Expansión de Conocimiento y Optimización de la Arquitectura RAG en Anclora Advisor AI: Hacia un Ecosistema de Asesoría Proactiva Basado en MCP y NotebookLM**

La evolución de los sistemas de asesoría técnica asistidos por inteligencia artificial ha alcanzado un punto de inflexión con la llegada de las arquitecturas de Generación Aumentada por Recuperación (RAG) de segunda generación. El proyecto Anclora Advisor AI representa una implementación sofisticada de este paradigma, integrando un entorno de ejecución moderno basado en Next.js 15 y Supabase con una capa de orquestación multi-agente diseñada para mitigar los riesgos inherentes a la pluriactividad profesional.1 La eficacia de este sistema no reside únicamente en la potencia de sus modelos de lenguaje —que oscilan entre el procesamiento local de Qwen 2.5 14b y la inferencia en la nube de Anthropic Claude 3.5— sino, fundamentalmente, en la profundidad y actualidad de su base de conocimientos técnica.1 Los tres cuadernos que conforman el núcleo de la asesoría (Fiscal, Laboral y Mercado) actúan como el grounding semántico necesario para evitar alucinaciones en dominios donde el error normativo conlleva consecuencias legales y financieras críticas.1 El presente informe detalla el análisis técnico de estos cuadernos y establece el protocolo de expansión de fuentes mediante el Model Context Protocol (MCP) de NotebookLM, garantizando que el agente de "antigravity" pueda inyectar información de alta relevancia para el ciclo operativo 2025-2026.1

## **Análisis de la Infraestructura y Gobernanza del Sistema RAG**

La arquitectura de Anclora Advisor AI se apoya en una base de datos PostgreSQL con la extensión pgvector para el almacenamiento y búsqueda de embeddings de 384 dimensiones, generados actualmente mediante el modelo all-minilm.1 Esta elección técnica garantiza una latencia reducida en entornos locales, aunque los informes de benchmark internos sugieren una transición hacia modelos más densos como bge-m3 para capturar con mayor precisión los matices del lenguaje jurídico español.1 El orquestador central, implementado en lib/agents/orchestrator.ts, gestiona el flujo de consultas mediante un sistema de enrutamiento que clasifica las intenciones del usuario hacia tres especialistas: fiscal, laboral o de mercado.1

La gobernanza del sistema es estricta y se rige por un marco de "Decision=NO-GO" ante inconsistencias en el entorno o en el alcance de las fuentes.1 Existe un identificador de proyecto canónico (lvpplnqbyvscpuljnzqf) que blinda la integridad de la base de conocimientos, impidiendo que datos de otros repositorios como Anclora Nexus contaminen el índice vectorial.1 Esta disciplina operativa es esencial al utilizar el MCP de NotebookLM, ya que la ingesta automatizada de fuentes externas requiere filtros de seguridad que validen el notebook\_id, el domain y la reason\_for\_fit antes de proceder al chunking y almacenamiento de los fragmentos.1 El sistema ya contempla un tamaño máximo de 1200 caracteres por fragmento con un solapamiento de 200 caracteres para preservar el contexto entre párrafos, lo cual es óptimo para la lectura de artículos del Estatuto de los Trabajadores o circulares de la Agencia Tributaria.1

| Componente Técnico | Implementación Actual | Recomendación de Evolución |
| :---- | :---- | :---- |
| Framework Web | Next.js 15 \+ React 19 | Mantener para soporte de Server Actions y Streaming 1 |
| Motor Vectorial | Supabase (pgvector) | Implementar Búsqueda Híbrida (Semántica \+ BM25) 1 |
| Modelo de Embeddings | all-minilm (384 dims) | Migrar a bge-m3 para mayor precisión en español 1 |
| Orquestación | RouterAgent (Anthropic) | Evolucionar a modelo Plan-and-Solve con herramientas externas 1 |
| Gobernanza RAG | Validación por project\_ref | Añadir validación de obsolescencia por fecha de fuente 1 |

## **Dimensionamiento del Cuaderno 01: Escudo Jurídico-Financiero y Fiscalidad en Baleares**

El cuaderno ANCLORA\_NOTEBOOK\_01\_FISCALIDAD\_AUTONOMO\_ES\_BAL constituye la primera línea de defensa para el profesional en pluriactividad. Su enfoque primordial es la gestión tributaria en el archipiélago balear, un territorio con particularidades fiscales significativas en cuanto a deducciones autonómicas y programas de fomento del autoempleo.2 El análisis de la base de conocimientos actual revela una cobertura sólida de los conceptos básicos (IAE, IVA, IRPF, RETA), pero detecta una brecha informativa respecto a las actualizaciones operativas para el bienio 2025-2026, específicamente en lo que respecta a la digitalización obligatoria de la facturación y los nuevos plazos de regularización de cuotas.4

### **La Revolución de la Cuota Cero y la Bonificación por Pluriactividad**

Una de las incorporaciones más urgentes para este cuaderno es la normativa detallada sobre la subvención de la "Cuota Cero" en las Islas Baleares. Según las últimas convocatorias publicadas en el BOIB para mayo de 2025, la Conselleria de Empresa, Empleo y Energía ha puesto en marcha un sistema de ayudas para compensar el 100% de la cuota de la Seguridad Social durante el primer año y parte del segundo, con extensiones para proyectos consolidados que no superen el Salario Mínimo Interprofesional (SMI).2 El sistema RAG debe integrar no solo los requisitos de acceso (como estar al corriente con la ATIB y la Seguridad Social), sino también los plazos críticos de solicitud, que para 2026 se prevén entre el 10 de mayo y el 10 de junio.6

La pluriactividad presenta un escenario de optimización financiera que el asesor debe ser capaz de desglosar. Un trabajador asalariado que inicia actividad como autónomo puede verse beneficiado por la devolución de oficio del 50% del exceso de cotizaciones por contingencias comunes, siempre que la suma de sus aportaciones en el Régimen General y el RETA supere los umbrales anuales fijados por la Ley de Presupuestos Generales del Estado.1 Además, existe la opción de renunciar a la cobertura de incapacidad temporal en el RETA si esta ya está cubierta en el contrato por cuenta ajena, lo que reduce la base de cotización efectiva.4 Estos matices técnicos requieren fuentes de alta precisión que superen el conocimiento generalista de los modelos base.

### **Implementación de Verifactu y Ley Antifraude 2026**

El horizonte de julio de 2026 marca la obligatoriedad para autónomos y pymes de utilizar sistemas de facturación que cumplan con el reglamento Verifactu.4 Esta normativa exige la generación de registros de facturación con integridad, trazabilidad y envío automático a la AEAT.4 El cuaderno fiscal debe ser reforzado con las especificaciones técnicas de estos sistemas para que el chat de Anclora Advisor AI pueda actuar como un consultor de cumplimiento (compliance) digital, alertando sobre la obsolescencia de programas de facturación manuales o no homologados.4

| Obligación Fiscal | Modelo / Referencia | Impacto para el Autónomo 2026 |
| :---- | :---- | :---- |
| IVA Trimestral | Modelo 303 | Presentación obligatoria telemática; plazos hasta día 20 8 |
| Pago Fraccionado IRPF | Modelo 130 | Cálculo sobre rendimientos netos reales 2025-2026 8 |
| Cuota Cero Baleares | Convocatoria 2026 | Reembolso del 100% de cuotas; solicitud en mayo 6 |
| Facturación Digital | Verifactu / Ley Antifraude | Obligatoriedad de software homologado desde julio 2026 4 |
| Regularización RETA | Ingresos Reales | Ajuste de cuotas según IRPF del ejercicio anterior 5 |

## **Dimensionamiento del Cuaderno 02: Blindaje de Transición y Gestión de Riesgo Laboral**

El segundo cuaderno, ANCLORA\_NOTEBOOK\_02\_TRANSICION\_RIESGO\_LABORAL, se posiciona como el "airbag estratégico" del sistema. Su finalidad es gestionar la delicada convivencia entre un contrato laboral por cuenta ajena —frecuentemente en el sector tecnológico— y el desarrollo de una actividad inmobiliaria propia.1 El análisis de este módulo destaca una dependencia crítica de la jurisprudencia reciente del Tribunal Supremo, la cual ha redefinido los estándares de "buena fe contractual" y las garantías procesales en el despido disciplinario.9

### **El Nuevo Paradigma de la Audiencia Previa**

La sentencia STS 1250/2024, de 18 de noviembre, ha introducido una exigencia formal ineludible: la obligatoriedad del trámite de audiencia previa antes de ejecutar un despido disciplinario.9 Este cambio doctrinal, basado en la aplicación directa del artículo 7 del Convenio 158 de la OIT, otorga al trabajador el derecho a ser escuchado y a presentar alegaciones antes de la extinción definitiva del vínculo laboral.12 Para el usuario de Anclora, este es un escudo vital. Muchas empresas tecnológicas intentan fundamentar despidos en la transgresión de la buena fe al detectar actividades paralelas.1 La falta de este trámite previo puede precipitar la declaración de improcedencia del despido, independientemente de la gravedad de los hechos imputados.12

Es imperativo que el cuaderno laboral se nutra de la jurisprudencia específica del Tribunal Superior de Justicia de las Islas Baleares (TSJIB). Sentencias como la STSJIB 82/2025, de 12 de febrero, han confirmado que en el ámbito regional balear esta exigencia ya era conocida y exigible incluso antes de la unificación de doctrina del Supremo, lo que eleva el riesgo para las empresas que operan en las islas sin protocolos disciplinarios actualizados.12 El asesor RAG debe ser capaz de desglosar este procedimiento para el usuario, indicando la necesidad de documentar cada comunicación con el empleador.

### **Exclusividad, No Competencia y Desconexión Digital**

La transposición de la Directiva (UE) 2019/1152 ha debilitado las cláusulas de exclusividad laboral genéricas. En la actualidad, el empresario no puede prohibir a un trabajador prestar servicios para otros empleadores fuera del horario laboral, a menos que exista un pacto de plena dedicación debidamente compensado económicamente o se incurra en competencia desleal manifiesta.15 El análisis del cuaderno laboral debe profundizar en el concepto de "concurrencia desleal" en el contexto de un profesional tecnológico que migra al inmobiliario; la disparidad de sectores industriales actúa como una defensa natural, pero el riesgo persiste si se utilizan recursos corporativos (software, bases de datos) para la actividad privada.1

La normativa de 2026 reforzará el derecho a la desconexión digital. Los nuevos registros horarios obligatorios, que deben detallar no solo el inicio y fin de la jornada sino también las pausas efectivas, se convertirán en una fuente de evidencia para ambas partes.16 Un profesional que realice gestiones inmobiliarias durante su jornada en la tecnológica estará dejando una huella digital que podría fundamentar una "quiebra de confianza".1 Las fuentes de este cuaderno deben incluir protocolos de estanqueidad tecnológica para el usuario, recomendando el uso de hardware y licencias de software independientes para su actividad autónoma.1

| Vector de Riesgo | Base Normativa / Jurisprudencia | Implicación Estratégica |
| :---- | :---- | :---- |
| Despido Disciplinario | STS 1250/2024 (18 Nov 2024\) | Nulidad/Improcedencia si falta Audiencia Previa 9 |
| Cláusula de Exclusividad | Directiva (UE) 2019/1152 | Inaplicable sin compensación económica específica 15 |
| Concurrencia Desleal | Art. 21 Estatuto de los Trabajadores | Permitida si los sectores no compiten directamente 1 |
| Registro Horario | Real Decreto 2026 (en trámite) | Interconexión obligatoria con Inspección de Trabajo 18 |
| Protección de Datos | STSJ Cataluña 2300/2024 | Pantallazos de PC empresa \= Falta Muy Grave 1 |

## **Dimensionamiento del Cuaderno 03: Motor Comercial y Autoridad de Mercado**

El cuaderno ANCLORA\_NOTEBOOK\_03\_MARCA\_POSICIONAMIENTO tiene como objetivo convertir al usuario en un referente técnico en el mercado inmobiliario de lujo del suroeste de Mallorca.1 El análisis de este módulo evidencia una transición desde la intermediación tradicional hacia la consultoría estratégica basada en datos, lo que requiere una integración profunda de informes de mercado de ultra-lujo y tendencias PropTech para el periodo 2025-2026.19

### **Dinámicas del Mercado Premium en el Suroeste de Mallorca**

El eje que conecta Port Andratx, Son Vida, Bendinat y Santa Ponça se ha consolidado como una de las regiones más resilientes de Europa. Los precios han mantenido una trayectoria ascendente con crecimientos que superan el 14% anual en zonas de máxima exclusividad como Port Andratx, donde el valor por metro cuadrado roza los 9.000 €.19 Para 2026, las previsiones de Knight Frank y Engel & Völkers apuntan a una estabilización de los precios en el segmento de lujo con subidas moderadas de entre el 2% y el 4%, impulsadas por la escasez física de suelo y las restricciones urbanísticas de la Ley de Costas.21

Un dato revelador para la base de conocimientos es el cambio en el perfil del comprador HNWI (High Net Worth Individual). El comprador actual es significativamente más joven (media de 46 años), tecnológicamente nativo y valora la "tecnología invisible" —domótica discreta, eficiencia energética A o B y sistemas de climatización geotérmica— por encima de la ostentación tradicional.21 El asesor inmobiliario de Anclora debe utilizar estas fuentes para construir una narrativa de "Humanista Aumentado", capaz de combinar la sensibilidad estética con la precisión analítica que ofrece el sistema interno Anclora Nexus.19

### **El Registro de Agentes Inmobiliarios (ROAIIB) como Factor de Autoridad**

Desde el 9 de noviembre de 2024, las Islas Baleares han implantado el Registro de Agentes Inmobiliarios (ROAIIB) de carácter obligatorio según la Ley 3/2024.24 Este hito normativo es fundamental para el posicionamiento comercial del usuario. La inscripción en el registro exige capacitación profesional, pólizas de seguro y garantías de conducta, lo que actúa como un filtro de calidad en un mercado tensionado por operadores no cualificados.24 El cuaderno de marca debe incluir los protocolos de inscripción telemática en el portal de la CAIB para que el usuario pueda exhibir su número de registro como un sello de legitimidad técnica.26

| Zona Inmobiliaria | Precio Medio m² (2026) | Tendencia 2025-2026 | Perfil del Comprador |
| :---- | :---- | :---- | :---- |
| Port Andratx | \~8.991 € | \+14,1% | Inversor DACH y EE.UU. (Cash-rich) 19 |
| Son Vida | \~5.411 € | \+11,7% | Familias, cercanía a colegios internacionales 19 |
| Bendinat / Portals | \~7.800 € | \+10,0% | Lifestyle náutico y rentabilidad en alquiler 19 |
| Santa Ponça | \~6.517 € | \+8,0% | Segunda residencia y golfistas 19 |
| Costa de la Calma | \~5.200 € | Estable | Retiro y compradores internacionales 19 |

## **Arquitectura de Ingesta Mediante MCP y NotebookLM**

La expansión de las fuentes mediante el Model Context Protocol de NotebookLM requiere una coordinación precisa entre el agente de "antigravity" y la infraestructura de Supabase. El objetivo no es simplemente añadir volumen, sino "densidad informativa actual".1 Para ello, el agente debe actuar siguiendo protocolos de búsqueda dirigidos que extraigan documentos estructurados, circulares oficiales y análisis sectoriales de fuentes de autoridad.

### **Metodología de Enriquecimiento de Datos**

El orquestador de Anclora Advisor AI utiliza una función RPC (match\_chunks) en la base de datos para realizar la recuperación semántica.1 Para que esta función siga siendo efectiva tras la expansión, es vital que las nuevas fuentes sean procesadas respetando el límite de dimensiones del vector (384) y el esquema de metadatos definido en la tabla rag\_documents.1 El agente MCP debe encargarse de normalizar el texto (eliminando saltos de línea excesivos y caracteres especiales) antes de entregarlo al script de ingesta local que genera los embeddings.1

La gobernanza de NotebookLM impone que cada fuente añadida sea justificada bajo el concepto de "reason\_for\_fit". Esta justificación es procesada por un agente evaluador que determina si el documento realmente pertenece al escudo fiscal, al airbag laboral o al motor comercial.1 Se han identificado tres focos de interés para las nuevas fuentes:

1. **Fuentes de Autoridad Normativa:** BOE, BOIB, circulares de la AEAT y resoluciones de la ATIB.3  
2. **Fuentes de Inteligencia de Mercado:** Informes de Knight Frank, PwC Real Estate y Idealista News para Baleares.21  
3. **Fuentes de Jurisprudencia Social:** Bases de datos de sentencias del Tribunal Supremo y TSJIB relativas al entorno laboral 2025\.14

## ---

**Entrega de Prompts Estratégicos para el Agente Antigravity**

A continuación se presentan los tres prompts solicitados, diseñados específicamente para ser ejecutados a través del MCP de NotebookLM. Cada prompt está estructurado para que el agente localice, filtre y prepare información que cubra las lagunas identificadas en el análisis previo.

### **Prompt 01: Actualización del Escudo Fiscal (NB01)**

**Objetivo:** Capturar la normativa operativa de 2026 en Baleares para blindar al autónomo frente a obligaciones digitales y nuevas subvenciones.

**Instrucciones para el Agente:** Actúa como un experto en tributación autonómica de las Islas Baleares. Utiliza el MCP de NotebookLM para buscar y sistematizar las fuentes oficiales publicadas entre enero de 2025 y marzo de 2026\.

**Foco de Búsqueda:**

1. Localiza el texto íntegro de la convocatoria de ayudas 'Cuota Cero' 2026 en el BOIB, detallando los plazos de presentación (ventana mayo-junio 2026\) y los requisitos de mantenimiento de alta en el RETA.7  
2. Extrae las especificaciones operativas del sistema Verifactu y la Ley Antifraude para autónomos, enfocándote en la fecha límite de julio de 2026 para el uso obligatorio de software homologado.4  
3. Recopila el calendario fiscal de la ATIB para el ejercicio 2026, con especial atención a los impuestos locales (IBI, IAE) y los periodos inhábiles en Baleares.27  
4. Identifica las deducciones autonómicas vigentes en el IRPF para 2025-2026 relativas a la conciliación y la vivienda habitual afecta a la actividad económica.3

**Requisitos de Salida:** Para cada fuente localizada, genera un objeto JSON compatible con el esquema de Anclora que incluya: title, source\_url, content (normalizado), notebook\_id (NB01), domain (fiscal) y una reason\_for\_fit que explique cómo esta información previene recargos por extemporaneidad o maximiza el ahorro del usuario mediante subvenciones.

### ---

**Prompt 02: Fortalecimiento del Airbag Laboral (NB02)**

**Objetivo:** Integrar el cambio de paradigma jurisprudencial sobre la audiencia previa y los nuevos riesgos de la digitalización laboral.

**Instrucciones para el Agente:** Actúa como un abogado laboralista especializado en relaciones de alta dirección y perfiles tecnológicos. Utiliza el MCP para realizar una revisión de la jurisprudencia social española del periodo 2025-2026.

**Foco de Búsqueda:**

1. Sistematiza el análisis de la sentencia STS 1250/2024 sobre la obligatoriedad de la audiencia previa en despidos disciplinarios, incluyendo comentarios doctrinales sobre las excepciones permitidas (riesgo de seguridad o terceros).9  
2. Localiza sentencias recientes del TSJ de Baleares (ej. STSJIB 82/2025) que apliquen la improcedencia del despido por falta de forma en el trámite de defensa del trabajador.12  
3. Extrae la normativa técnica del nuevo registro horario digital obligatorio 2026, detallando los requisitos de interoperabilidad con la Inspección de Trabajo y el control de pausas para café o tabaco.16  
4. Recopila guías sobre la Ley de Desconexión Digital aplicadas al teletrabajo y la pluriactividad, enfocándote en el blindaje de la privacidad del hardware personal frente a la monitorización empresarial.17

**Requisitos de Salida:** Genera fragmentos estructurados con el notebook\_id (NB02), dominio laboral y una reason\_for\_fit centrada en la mitigación del riesgo de despido "con causa" y la protección de la reputación profesional del usuario en transición.

### ---

**Prompt 03: Evolución de la Autoridad de Mercado y PropTech (NB03)**

**Objetivo:** Capturar la inteligencia de mercado de ultra-lujo 2026 y los marcos legales de profesionalización inmobiliaria en Baleares.

**Instrucciones para el Agente:** Actúa como un analista de mercado de una firma de consultoría inmobiliaria de lujo. Utiliza el MCP para acceder a informes sectoriales y bases de datos registrales de las Islas Baleares de 2025-2026.

**Foco de Búsqueda:**

1. Extrae las estadísticas de precios por m² y volúmenes de transacciones en el suroeste de Mallorca (Andratx, Calvià, Son Vida) de los informes de 2026 de Knight Frank y Engel & Völkers.19  
2. Identifica las tendencias PropTech dominantes para 2026, específicamente la adopción de IA para análisis predictivo de ROI y la demanda de 'Vivienda Serena' con certificaciones energéticas A.23  
3. Localiza el protocolo de inscripción en el Registro de Agentes Inmobiliarios de las Islas Baleares (ROAIIB), detallando los requisitos de póliza de responsabilidad civil y las sanciones por operar sin registro en 2026\.24  
4. Recopila datos sobre las nuevas restricciones al alquiler turístico en zonas tensionadas de Palma y Calvià para 2026, analizando su impacto en el valor de los activos con licencia antigua.32

**Requisitos de Salida:** Estructura la información para el notebook\_id (NB03), dominio mercado y una reason\_for\_fit que destaque el posicionamiento del usuario como un 'Asesor de Precisión' con acceso a datos que no están disponibles para el público general.

## ---

**Impacto Técnico y Operativo de la Expansión RAG**

La inyección de estas fuentes mediante el agente de "antigravity" transformará el perfil de respuesta de Anclora Advisor AI. Al pasar de un corpus estático a uno dinámico que contempla el ciclo 2026, el orquestador podrá ejecutar funciones de asesoría preventiva con una confianza de grounding significativamente superior.

### **Optimización del Proceso de Inferencia**

El uso de las nuevas fuentes permitirá al sistema aplicar técnicas de "Contextual Chunking".1 En lugar de tratar cada fragmento de ley de forma aislada, el orquestador podrá vincular el artículo del Estatuto de los Trabajadores (fuente estática) con la sentencia del Supremo de 2025 (fuente dinámica inyectada por el MCP), ofreciendo una respuesta sintética que represente el estado actual del derecho.

Desde el punto de vista del hardware, la mayor densidad informativa exigirá una gestión eficiente de la memoria VRAM y el NPU de los procesadores Intel Core Ultra.1 El informe de benchmark sugiere que la generación de texto debe delegarse en la GPU RTX 3050 (preferiblemente mediante Ollama con framework NVIDIA), mientras que el NPU/iGPU se especializa en el procesamiento de los nuevos vectores y el re-ranking local.1

### **Evaluación y Verificación de Resultados**

Tras la ejecución de los prompts, el equipo debe validar los KPIs de recuperación mediante el script npm run rag:eval:gate.1 Se espera que la métrica hit@5 se mantenga por encima de 0.95, incluso con el aumento de volumen de fuentes, y que la tasa de fallback en consultas de dominio disminuya al 0% para temas de actualidad como la Cuota Cero 2026\.1

| Métrica de Calidad RAG | Estado Pre-Expansión | Objetivo Post-Expansión |
| :---- | :---- | :---- |
| Tasa de Citas Inline | 100% (si hay evidencia) | 100% (incluyendo novedades 2026\) 1 |
| Latencia de Retrieval | \~1.5s / chunk | \< 1.0s (Optimizando NPU) 1 |
| Precisión Semántica (MRR) | 1.000 | \> 0.85 (en corpus masivo) 1 |
| Grounding Confidence | Medium / High | Strict High (por fuentes oficiales) 1 |
| Error de Dimensión | 0% | 0% (Validación estricta 384 dims) 1 |

## **Conclusiones Estratégicas para el Ciclo 2025-2026**

La arquitectura de Anclora Advisor AI está preparada para dar el salto desde un prototipo funcional hacia una plataforma de grado empresarial capaz de gestionar la incertidumbre normativa de 2026\. La clave de esta transición radica en la simbiosis entre el orquestador multi-agente y la ingesta continua de fuentes de alta autoridad a través del MCP de NotebookLM.

La implementación de los tres prompts detallados en este informe no solo cumple con el requisito técnico de ampliar los cuadernos, sino que dota al sistema de una "conciencia temporal" fundamental para el asesoramiento de alto nivel. Un usuario que consulta hoy sobre su transición laboral recibirá una respuesta blindada por la jurisprudencia de ayer y preparada para las obligaciones digitales de mañana.

Se recomienda al desarrollador principal:

1. **Ejecutar los prompts en tandas de 5 fuentes por cuaderno** para evitar el ruido semántico y monitorizar el impacto en la latencia del orquestador.1  
2. **Activar el re-ranker local bge-reranker-v2-m3** para procesar los 20 fragmentos recuperados de la base de datos expandida y seleccionar los 5 más pertinentes antes de enviarlos al LLM.1  
3. **Mantener la política de project\_ref canónico** para evitar que la automatización del agente de "antigravity" introduzca datos de otros ecosistemas que degraden la especificidad del asesor.1

Con esta estrategia, Anclora Advisor AI se consolida como el motor de precisión definitivo para el profesional que entiende que, en el siglo XXI, la mejor intuición es aquella que está respaldada por una estructura de datos impecable y perpetuamente actualizada.

#### **Obras citadas**

1. toniiapro73-anclora-advisor-ai-8a5edab282632443.txt  
2. Nueva subvención cuota cero de autónomos para personas emprendedoras \- ibempren, fecha de acceso: marzo 3, 2026, [https://ibempren.es/es/nueva-subvencion-cuota-cero-de-autonomos-para-personas-emprendedoras/](https://ibempren.es/es/nueva-subvencion-cuota-cero-de-autonomos-para-personas-emprendedoras/)  
3. A.T.I.B. 292 \- Agència Tributària de les Illes Balears, fecha de acceso: marzo 3, 2026, [https://atib.es/Default.aspx/General/Novedad.aspx?idTipoTexto=1\&idTexto=16814\&lang=es](https://atib.es/Default.aspx/General/Novedad.aspx?idTipoTexto=1&idTexto=16814&lang=es)  
4. Cómo darte de alta como autónomo en 2026: trámites, ayudas y obligaciones fiscales, fecha de acceso: marzo 3, 2026, [https://www.fiscal-impuestos.com/alta-autonomo-2026-tramites-ayudas-obligaciones-fiscales](https://www.fiscal-impuestos.com/alta-autonomo-2026-tramites-ayudas-obligaciones-fiscales)  
5. Las principales novedades para autónomos en 2026 \- Talenom, fecha de acceso: marzo 3, 2026, [https://talenom.com/es-es/blog/autonomos/novedades-autonomos-2023/](https://talenom.com/es-es/blog/autonomos/novedades-autonomos-2023/)  
6. Baleares pone en marcha varias ayudas dirigidas a autónomos para 2026, incluida la cuota cero, fecha de acceso: marzo 3, 2026, [https://www.autonomosyemprendedor.es/articulo/ayudas-subvenciones/baleares-pone-marcha-varias-ayudas-dirigidas-autonomos-2026-incluida-cuota-cero/20260225140759052192.html](https://www.autonomosyemprendedor.es/articulo/ayudas-subvenciones/baleares-pone-marcha-varias-ayudas-dirigidas-autonomos-2026-incluida-cuota-cero/20260225140759052192.html)  
7. Cuota cero de autónomos para emprendedores \- CAIB, fecha de acceso: marzo 3, 2026, [https://www.caib.es/sites/quotazero/es/ayudas\_2024\_autonomos\_cuota\_cero/](https://www.caib.es/sites/quotazero/es/ayudas_2024_autonomos_cuota_cero/)  
8. Calendario fiscal 2026 para autónomos y PYMES | Cuéntica, fecha de acceso: marzo 3, 2026, [https://cuentica.com/asesoria/calendario-fiscal-2026-autonomos-empresas/](https://cuentica.com/asesoria/calendario-fiscal-2026-autonomos-empresas/)  
9. Audiencia Previa Despidos Disciplinarios \- Gestolasa, fecha de acceso: marzo 3, 2026, [https://gestolasa.es/audiencia-previa-despidos-disciplinarios/](https://gestolasa.es/audiencia-previa-despidos-disciplinarios/)  
10. El Tribunal Supremo fija que las empresas no pueden despedir disciplinariamente a los trabajadores sin abrir trámite de 'audiencia previa' | CGPJ | Poder Judicial, fecha de acceso: marzo 3, 2026, [https://www.poderjudicial.es/cgpj/es/Poder-Judicial/Tribunal-Supremo/Noticias-Judiciales/El-Tribunal-Supremo-fija-que-las-empresas-no-pueden-despedir-disciplinariamente-a-los-trabajadores-sin-abrir-tramite-de--audiencia-previa-](https://www.poderjudicial.es/cgpj/es/Poder-Judicial/Tribunal-Supremo/Noticias-Judiciales/El-Tribunal-Supremo-fija-que-las-empresas-no-pueden-despedir-disciplinariamente-a-los-trabajadores-sin-abrir-tramite-de--audiencia-previa-)  
11. LA AUDIENCIA PREVIA EN EL DESPIDO DISCIPLINARIO: UN NUEVO PARADIGMA TRAS EL CAMBIO DE DOCTRINA DEL TRIBUNAL SUPREMO \- Uría Menéndez, fecha de acceso: marzo 3, 2026, [https://www.uria.com/documentos/publicaciones/9547/documento/UM-AJUM\_68.pdf?id=14193\&forceDownload=true](https://www.uria.com/documentos/publicaciones/9547/documento/UM-AJUM_68.pdf?id=14193&forceDownload=true)  
12. La audiencia previa y la improcedencia del despido disciplinario \- RSM Global, fecha de acceso: marzo 3, 2026, [https://www.rsm.global/spain/es/insights/la-improcedencia-del-despido-disciplinario](https://www.rsm.global/spain/es/insights/la-improcedencia-del-despido-disciplinario)  
13. El despido disciplinario sin la audiencia previa del Convenio núm. 158 de la OIT: ¿improcedente por un defecto formal? \- Revista, fecha de acceso: marzo 3, 2026, [https://revistas.cef.udima.es/index.php/rtss/article/view/24801](https://revistas.cef.udima.es/index.php/rtss/article/view/24801)  
14. La audiencia previa sí puede ser exigible con anterioridad a la STS ..., fecha de acceso: marzo 3, 2026, [https://ignasibeltran.com/2025/03/19/la-audiencia-previa-si-puede-ser-exigible-con-anterioridad-a-la-sts-18-11-24-y-su-incumplimiento-precipitar-la-improcedencia-del-despido-stsj-baleares-12-2-25/](https://ignasibeltran.com/2025/03/19/la-audiencia-previa-si-puede-ser-exigible-con-anterioridad-a-la-sts-18-11-24-y-su-incumplimiento-precipitar-la-improcedencia-del-despido-stsj-baleares-12-2-25/)  
15. Trabajo prepara la ley que prohíbe exigir exclusividad a los empleados \- Grupo2000, fecha de acceso: marzo 3, 2026, [https://www.grupo2000.es/trabajo-prepara-la-ley-que-prohibe-exigir-exclusividad-a-los-empleados/](https://www.grupo2000.es/trabajo-prepara-la-ley-que-prohibe-exigir-exclusividad-a-los-empleados/)  
16. Novedades laborales 2026: claves y reformas en España \- Cosas Legales, fecha de acceso: marzo 3, 2026, [https://www.cosaslegales.es/novedades-laborales-2026-en-espana-reformas-que-pueden-cambiar-el-dia-a-dia-en-empresas-y-trabajadores/](https://www.cosaslegales.es/novedades-laborales-2026-en-espana-reformas-que-pueden-cambiar-el-dia-a-dia-en-empresas-y-trabajadores/)  
17. Novedades legales 2025: laboral y mercantil \- APD, fecha de acceso: marzo 3, 2026, [https://www.apd.es/novedades-legales-2025/](https://www.apd.es/novedades-legales-2025/)  
18. Novedades laborales 2026 que debes conocer | Wolters Kluwer, fecha de acceso: marzo 3, 2026, [https://www.wolterskluwer.com/es-es/expert-insights/novedades-laborales-2026](https://www.wolterskluwer.com/es-es/expert-insights/novedades-laborales-2026)  
19. El mercado inmobiliario de Mallorca en 2026: una visión completa, fecha de acceso: marzo 3, 2026, [https://yes-mallorca-inmuebles.es/blog/info/mercado-inmobiliario-de-mallorca-en-2026/](https://yes-mallorca-inmuebles.es/blog/info/mercado-inmobiliario-de-mallorca-en-2026/)  
20. Precios de viviendas en Port d'Andratx – Evolución y mercado 2026 \- Engel & Völkers, fecha de acceso: marzo 3, 2026, [https://www.engelvoelkers.com/es/es/precios-inmobiliarios/islas-baleares/port-dandratx](https://www.engelvoelkers.com/es/es/precios-inmobiliarios/islas-baleares/port-dandratx)  
21. Why is Mallorca set to be in the spotlight in 2026? \- Knight Frank, fecha de acceso: marzo 3, 2026, [https://www.knightfrank.co.uk/research/article/2025/12/mallorcas-set-to-be-the-spotlight-in-2026](https://www.knightfrank.co.uk/research/article/2025/12/mallorcas-set-to-be-the-spotlight-in-2026)  
22. Precios de viviendas en Son Vida – Evolución y mercado 2026 \- Engel & Völkers Germany, fecha de acceso: marzo 3, 2026, [https://www.engelvoelkers.com/es/es/precios-inmobiliarios/islas-baleares/son-vida/son-vida](https://www.engelvoelkers.com/es/es/precios-inmobiliarios/islas-baleares/son-vida/son-vida)  
23. ¿Qué nos atrae del mundo de la vivienda de lujo? la tendencia inmobiliaria para Madrid 2026 \- HousinGo, fecha de acceso: marzo 3, 2026, [https://www.housingo.es/es/blog/post/que-nos-atrae-del-mundo-de-la-vivienda-de-lujo](https://www.housingo.es/es/blog/post/que-nos-atrae-del-mundo-de-la-vivienda-de-lujo)  
24. Registro Obligatorio de Agentes Inmobiliarios en Baleares \- Ibiza Prestige Properties, fecha de acceso: marzo 3, 2026, [https://ibizaprestige.es/registro-agente-inmobiliario-baleares/](https://ibizaprestige.es/registro-agente-inmobiliario-baleares/)  
25. ROAIIB – El Registro de Agentes Inmobiliarios de las Islas Baleares \- Aicat Barcelona, fecha de acceso: marzo 3, 2026, [https://aicat.barcelona/es/blog/raiib-registro-de-agentes-inmobiliarios-de-las-islas-baleares/](https://aicat.barcelona/es/blog/raiib-registro-de-agentes-inmobiliarios-de-las-islas-baleares/)  
26. Registro de Agentes Inmobiliarios de las Islas Baleares \- CAIB, fecha de acceso: marzo 3, 2026, [https://www.caib.es/seucaib/es/tramites/tramite/6142531](https://www.caib.es/seucaib/es/tramites/tramite/6142531)  
27. Agència Tributària de les Illes Balears \- A.T.I.B. 301, fecha de acceso: marzo 3, 2026, [https://www.atib.es/TL/CalendarioFiscal.aspx?mun=3\&lang=es](https://www.atib.es/TL/CalendarioFiscal.aspx?mun=3&lang=es)  
28. Tendencias en el mercado inmobiliario en Europa en 2026 \- PwC España, fecha de acceso: marzo 3, 2026, [https://www.pwc.es/es/real-estate/tendencias-mercado-inmobiliario-europa-2026.html](https://www.pwc.es/es/real-estate/tendencias-mercado-inmobiliario-europa-2026.html)  
29. 10 sentencias del Tribunal Supremo sobre despidos que han marcado 2025, fecha de acceso: marzo 3, 2026, [https://www.asesor-laboral.es/2025/12/29/10-sentencias-del-tribunal-supremo-sobre-despidos-que-han-marcado-2025/](https://www.asesor-laboral.es/2025/12/29/10-sentencias-del-tribunal-supremo-sobre-despidos-que-han-marcado-2025/)  
30. Agència Tributària de les Illes Balears \- ATIB, fecha de acceso: marzo 3, 2026, [https://www.atib.es/general/mostrar\_textolargo.aspx?idTexto=5369\&lang=es](https://www.atib.es/general/mostrar_textolargo.aspx?idTexto=5369&lang=es)  
31. Tamaño, participación y tendencias del mercado de PropTech | Informe de previsión \[2034\], fecha de acceso: marzo 3, 2026, [https://www.fortunebusinessinsights.com/es/proptech-market-108634](https://www.fortunebusinessinsights.com/es/proptech-market-108634)  
32. El mercado inmobiliario en Mallorca 2026: entre demanda fuerte y oferta limitada, fecha de acceso: marzo 3, 2026, [https://www.privatepropertymallorca.com/es/generally-de-es/el-mercado-inmobiliario-en-mallorca-2026-entre-demanda-fuerte-y-oferta-limitada/](https://www.privatepropertymallorca.com/es/generally-de-es/el-mercado-inmobiliario-en-mallorca-2026-entre-demanda-fuerte-y-oferta-limitada/)  
33. Actualización inmobiliaria España e Islas Baleares 2026 \- Bufete Frau, fecha de acceso: marzo 3, 2026, [https://bufetefrau.com/es/actualizacion-inmobiliaria-espana-e-islas-baleares-2026/](https://bufetefrau.com/es/actualizacion-inmobiliaria-espana-e-islas-baleares-2026/)