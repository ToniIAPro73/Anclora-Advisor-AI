import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Términos del servicio | Anclora Advisor AI",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Términos del servicio"
      description="Condiciones de uso de Anclora Advisor AI como herramienta asistida de consulta y operación interna."
      blocks={[
        {
          title: "Entidad operadora",
          paragraphs: [
            "Anclora Advisor AI es una marca comercial operada bajo licencia exclusiva por Anclora Group.",
            "La entidad propietaria y operadora del servicio es Anclora Group. El contacto común es hola@anclora.com.",
          ],
        },
        {
          title: "Objeto del servicio",
          paragraphs: [
            "El servicio proporciona asistencia informativa y operativa en materia fiscal, laboral, facturación, alertas y gestión documental.",
            "La información no sustituye asesoramiento profesional, revisión legal, criterio administrativo ni decisión de un especialista habilitado.",
          ],
        },
        {
          title: "Uso responsable",
          paragraphs: [
            "El usuario debe revisar los resultados, mantener la confidencialidad de sus credenciales y no subir información de terceros sin base legítima.",
            "Anclora Group puede registrar actividad técnica y operativa para seguridad, trazabilidad y mejora del servicio.",
          ],
        },
      ]}
    />
  );
}
