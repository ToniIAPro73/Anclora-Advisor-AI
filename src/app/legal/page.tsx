import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Aviso legal | Anclora Advisor AI",
};

export default function LegalPage() {
  return (
    <LegalDocument
      title="Aviso legal"
      description="Información de titularidad, naturaleza del servicio, propiedad intelectual y marco legal de Anclora Advisor AI."
      blocks={[
        {
          title: "1. Titularidad y operador",
          paragraphs: [
            "Titular y operador: Anclora Group.",
            "Anclora Advisor AI forma parte del ecosistema tecnológico de Anclora Group. No se afirma registro concedido de marca.",
            "Contacto: hola@anclora.com.",
          ],
        },
        {
          title: "2. Naturaleza del servicio",
          paragraphs: [
            "Anclora Advisor AI es una herramienta de asesoramiento orientativo asistido por inteligencia artificial. No actúa como despacho de abogados, asesoría fiscal, gestoría ni intermediario financiero regulado.",
            "Las respuestas generadas son informativas y orientativas. No constituyen asesoramiento profesional vinculante de ningún tipo.",
          ],
        },
        {
          title: "3. Condiciones de acceso",
          paragraphs: [
            "El acceso al servicio está restringido a usuarios autorizados por Anclora Group. El acceso no autorizado está prohibido y puede dar lugar a acciones legales.",
          ],
        },
        {
          title: "4. Propiedad intelectual e industrial",
          paragraphs: [
            "La plataforma Anclora Advisor AI, su código fuente, diseño, flujos, documentación propia, prompts estructurales y activos intangibles son propiedad de Anclora Group o están licenciados a su favor.",
            "Los documentos, inputs y datos aportados por el usuario para consulta pertenecen al usuario o a su titular legítimo.",
          ],
        },
        {
          title: "5. Responsabilidad sobre contenidos y outputs",
          paragraphs: [
            "Anclora Group realiza los esfuerzos razonables para mantener la calidad y actualidad del servicio, pero no garantiza la exactitud de las respuestas generadas por IA.",
            "El usuario es responsable de validar los outputs antes de tomar decisiones en base a ellos. Anclora Group no asume responsabilidad por daños derivados del uso de outputs sin validación profesional.",
          ],
        },
        {
          title: "6. Marca Anclora Advisor AI",
          paragraphs: [
            "Anclora Advisor AI forma parte del ecosistema tecnológico de Anclora Group. Las marcas, nombres comerciales y logotipos de Anclora son propiedad de Anclora Group y no pueden usarse sin autorización expresa.",
          ],
        },
        {
          title: "7. Legislación aplicable",
          paragraphs: [
            "Este aviso legal se rige por la legislación española y de la Unión Europea. Las partes se someten a los juzgados y tribunales competentes conforme a la normativa aplicable.",
          ],
        },
        {
          title: "8. Contacto",
          paragraphs: [
            "Para cuestiones legales: hola@anclora.com.",
          ],
        },
      ]}
    />
  );
}
