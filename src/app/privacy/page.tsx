import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Política de privacidad | Anclora Advisor AI",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Política de privacidad"
      description="Información sobre el tratamiento de datos personales en Anclora Advisor AI, herramienta asistida de consulta, asesoramiento orientativo y gestión documental."
      blocks={[
        {
          title: "1. Responsable del tratamiento",
          paragraphs: [
            "El responsable del tratamiento es Anclora Group, propietario y operador de Anclora Advisor AI.",
            "Contacto: hola@anclora.com.",
          ],
        },
        {
          title: "2. Datos que tratamos",
          paragraphs: [
            "Anclora Advisor AI puede tratar las siguientes categorías de datos: credenciales de acceso (email y contraseña cifrada); datos de sesión y autenticación; consultas e inputs introducidos por el usuario en la plataforma; documentos y archivos aportados voluntariamente para análisis o consulta; preferencias de configuración y personalización; registros técnicos de actividad necesarios para seguridad, trazabilidad y mejora del servicio.",
            "Los documentos e inputs aportados por el usuario permanecen bajo su titularidad. Anclora Advisor AI los procesa únicamente para dar respuesta a la consulta formulada.",
          ],
        },
        {
          title: "3. Finalidades del tratamiento",
          paragraphs: [
            "Prestar el servicio de asesoramiento orientativo y gestión documental asistida por IA.",
            "Gestionar la autenticación y el acceso a la plataforma.",
            "Mantener la seguridad, trazabilidad y auditoría del servicio.",
            "Mejorar el servicio a partir de datos de uso agregados, cuando resulte aplicable.",
          ],
        },
        {
          title: "4. Base jurídica",
          paragraphs: [
            "El tratamiento se basa en la ejecución del acuerdo de acceso al servicio (art. 6.1.b RGPD) para las finalidades operativas esenciales, y en el interés legítimo (art. 6.1.f RGPD) para la seguridad y mejora del servicio.",
            "El consentimiento (art. 6.1.a RGPD) aplica para cookies opcionales.",
          ],
        },
        {
          title: "5. Conservación de los datos",
          paragraphs: [
            "Los datos de acceso y sesión se conservan durante la vigencia del acceso y hasta su revocación o solicitud de supresión.",
            "Los inputs y consultas pueden conservarse temporalmente para mejorar la calidad de las respuestas, salvo que el usuario solicite su eliminación.",
            "Los logs técnicos se eliminan transcurrido el período mínimo necesario para la seguridad operativa.",
          ],
        },
        {
          title: "6. Destinatarios y cesiones",
          paragraphs: [
            "No se ceden datos a terceros salvo obligación legal. Los datos pueden ser procesados por proveedores de infraestructura cloud actuando como encargados del tratamiento bajo las garantías contractuales pertinentes.",
            "Los modelos de IA utilizados pueden procesar los inputs según sus condiciones de uso; no se garantiza que los datos no sean utilizados por el proveedor del modelo para entrenamiento. El usuario debe evitar incluir datos personales sensibles en sus consultas cuando no sea estrictamente necesario.",
          ],
        },
        {
          title: "7. Seguridad",
          paragraphs: [
            "Anclora Advisor AI aplica medidas técnicas y organizativas adecuadas, incluyendo comunicaciones cifradas mediante HTTPS y control de acceso por autenticación.",
            "No se garantiza ningún nivel de seguridad bancaria ni cifrado en reposo adicional al proporcionado por la infraestructura del servicio.",
          ],
        },
        {
          title: "8. Derechos del interesado",
          paragraphs: [
            "Conforme al RGPD (UE) 2016/679 y la LOPDGDD, puedes ejercer los derechos de acceso, rectificación, supresión, portabilidad, oposición y limitación del tratamiento.",
            "Envía tu solicitud a hola@anclora.com. También puedes presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en www.aepd.es.",
          ],
        },
        {
          title: "9. Cookies",
          paragraphs: [
            "La app usa cookies necesarias para sesión, seguridad, idioma y preferencias. Las cookies opcionales de análisis operativo o marketing permanecen desactivadas salvo consentimiento explícito del usuario.",
            "Puedes gestionar tus preferencias de cookies desde el panel disponible en el pie de página.",
          ],
        },
        {
          title: "10. Contacto",
          paragraphs: [
            "Para cualquier cuestión sobre privacidad: hola@anclora.com.",
          ],
        },
      ]}
    />
  );
}
