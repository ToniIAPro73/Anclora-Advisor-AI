import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Aviso legal | Anclora Advisor AI",
};

export default function LegalPage() {
  return (
    <LegalDocument
      title="Aviso legal"
      description="Información de titularidad, marca y contacto de Anclora Advisor AI."
      blocks={[
        {
          title: "Titularidad",
          paragraphs: [
            "Titular y operador: Anclora Group.",
            "Anclora Advisor AI es una marca comercial operada bajo licencia exclusiva por Anclora Group. No se afirma registro concedido de marca.",
          ],
        },
        {
          title: "Contacto",
          paragraphs: ["Email común de contacto: hola@anclora.com."],
        },
        {
          title: "Propiedad intelectual",
          paragraphs: [
            "La identidad visual, interfaz, flujos de producto, documentación propia y activos intangibles del servicio se gobiernan bajo Anclora Group, sin perjuicio de derechos de terceros o datos aportados por usuarios.",
          ],
        },
      ]}
    />
  );
}
