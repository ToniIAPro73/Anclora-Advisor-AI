import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Política de privacidad | Anclora Advisor AI",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Política de privacidad"
      description="Tratamiento de datos personales en Anclora Advisor AI, plataforma interna de asesoramiento fiscal, laboral y de mercado."
      blocks={[
        {
          title: "Responsable y contacto",
          paragraphs: [
            "Responsable del tratamiento: Anclora Group, entidad propietaria y operadora de Anclora Advisor AI.",
            "Contacto para privacidad y soporte operativo: hola@anclora.com.",
          ],
        },
        {
          title: "Datos tratados",
          paragraphs: [
            "Podemos tratar datos de cuenta, autenticación, sesión, consultas introducidas por el usuario, documentos aportados voluntariamente y registros técnicos necesarios para seguridad y auditoría.",
            "Las respuestas generadas por la plataforma son orientativas y deben validarse antes de tomar decisiones fiscales, laborales, mercantiles o contractuales.",
          ],
        },
        {
          title: "Cookies",
          paragraphs: [
            "La app usa cookies necesarias para sesión, seguridad, idioma y preferencias. Las cookies opcionales de análisis operativo o marketing permanecen desactivadas salvo consentimiento.",
          ],
        },
      ]}
    />
  );
}
