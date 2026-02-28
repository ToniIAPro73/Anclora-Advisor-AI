import type { InvoiceRecord } from "@/lib/invoices/contracts";
import { generateInvoicePdfBuffer, getInvoicePdfFileName } from "@/lib/invoices/pdf";
import { type EmailSendResult, type EmailSender } from "@/lib/notifications/smtp";
import { buildInvoiceReference } from "@/lib/invoices/service";

export type InvoiceDeliveryResult = {
  messageId: string;
  attachmentFilename: string;
  subject: string;
};

export async function deliverInvoiceByEmail(params: {
  invoice: InvoiceRecord;
  recipientEmail: string;
  emailSender: EmailSender;
}): Promise<InvoiceDeliveryResult> {
  const { invoice, recipientEmail, emailSender } = params;
  const invoiceReference = buildInvoiceReference(invoice.series, invoice.invoice_number);
  const attachmentFilename = getInvoicePdfFileName(invoice);
  const pdfBuffer = await generateInvoicePdfBuffer({
    ...invoice,
    recipient_email: recipientEmail,
  });
  const subject = `Factura ${invoiceReference} - ${invoice.client_name}`;

  const result: EmailSendResult = await emailSender.send({
    to: recipientEmail,
    subject,
    text: [
      `Hola ${invoice.client_name},`,
      "",
      `Adjuntamos la factura ${invoiceReference}.`,
      `Importe total: ${Number(invoice.total_amount).toFixed(2)} EUR.`,
      "",
      "Un saludo,",
      "Anclora Advisor AI",
    ].join("\n"),
    html: [
      `<p>Hola ${invoice.client_name},</p>`,
      `<p>Adjuntamos la factura <strong>${invoiceReference}</strong>.</p>`,
      `<p>Importe total: <strong>${Number(invoice.total_amount).toFixed(2)} EUR</strong>.</p>`,
      "<p>Un saludo,<br />Anclora Advisor AI</p>",
    ].join(""),
    attachments: [
      {
        filename: attachmentFilename,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return {
    messageId: result.messageId,
    attachmentFilename,
    subject,
  };
}
