import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Términos del servicio | Anclora Advisor AI",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Términos del servicio"
      description="Condiciones de uso de Anclora Advisor AI como herramienta asistida de consulta orientativa y gestión documental."
      blocks={[
        {
          title: "1. Entidad operadora",
          paragraphs: [
            "Anclora Advisor AI forma parte del ecosistema tecnológico de Anclora Group.",
            "La entidad propietaria y operadora del servicio es Anclora Group. Contacto: hola@anclora.com.",
          ],
        },
        {
          title: "2. Objeto del servicio",
          paragraphs: [
            "Anclora Advisor AI proporciona asistencia informativa y orientativa en materia fiscal, laboral, mercantil, documental y de mercado, asistida por inteligencia artificial.",
            "El servicio no sustituye asesoramiento profesional habilitado, revisión legal, criterio administrativo firme ni decisión de un especialista certificado. Las respuestas son orientativas.",
          ],
        },
        {
          title: "3. Condiciones de uso",
          paragraphs: [
            "El acceso al servicio es personal e intransferible. No está permitido compartir credenciales ni usar el servicio de forma automatizada no autorizada.",
            "El uso del servicio está limitado a fines profesionales y legítimos. No está permitido usar la plataforma para fines ilícitos, difamatorios o que vulneren derechos de terceros.",
          ],
        },
        {
          title: "4. Responsabilidades del usuario",
          paragraphs: [
            "El usuario es responsable de revisar y validar las respuestas generadas antes de tomar decisiones relevantes basadas en ellas.",
            "El usuario debe mantener la confidencialidad de sus credenciales y notificar cualquier uso no autorizado.",
            "El usuario no debe introducir datos personales sensibles de terceros en los inputs salvo necesidad justificada y con las autorizaciones pertinentes.",
          ],
        },
        {
          title: "5. Carácter orientativo de los outputs",
          paragraphs: [
            "Las respuestas generadas por la IA son de naturaleza informativa y orientativa. Pueden contener errores, imprecisiones o información no actualizada.",
            "Anclora Group no garantiza la exactitud, completitud ni adecuación de los outputs para ningún propósito específico. El usuario asume la responsabilidad de validar cualquier output antes de actuar en base a él.",
          ],
        },
        {
          title: "6. Limitaciones del servicio",
          paragraphs: [
            "El servicio puede estar sujeto a interrupciones por mantenimiento, actualizaciones o causas ajenas. No se establece ningún SLA salvo acuerdo específico por escrito.",
            "Los modelos de IA tienen limitaciones inherentes. Los resultados pueden variar según el contexto, la formulación de la consulta y la información disponible en el modelo.",
          ],
        },
        {
          title: "7. Propiedad intelectual",
          paragraphs: [
            "La plataforma Anclora Advisor AI, su interfaz, flujos, documentación y activos propios son propiedad de Anclora Group.",
            "Los documentos e inputs aportados por el usuario para consulta pertenecen al usuario o a su titular legítimo. Anclora Group no reclama propiedad sobre dichos datos.",
          ],
        },
        {
          title: "8. Exclusión de garantías",
          paragraphs: [
            "El servicio se presta en las condiciones técnicas disponibles. Anclora Group no garantiza resultados específicos ni que los outputs sean adecuados para las circunstancias particulares del usuario.",
          ],
        },
        {
          title: "9. Limitación de responsabilidad",
          paragraphs: [
            "Anclora Group no asume responsabilidad por pérdidas, decisiones, actos u omisiones derivados del uso de los outputs del servicio sin la validación profesional correspondiente.",
            "La responsabilidad máxima de Anclora Group se limita a lo establecido en la normativa aplicable.",
          ],
        },
        {
          title: "10. Contacto",
          paragraphs: [
            "Para cuestiones sobre estos términos: hola@anclora.com.",
          ],
        },
      ]}
    />
  );
}
