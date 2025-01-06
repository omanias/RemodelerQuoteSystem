import PDFDocument from 'pdfkit';
import { Quote, Company, Template } from '@db/schema';
import path from 'path';
import fs from 'fs';

interface GenerateQuotePDFParams {
  quote: Quote & {
    template: Template;
  };
  company: Company;
}

export async function generateQuotePDF({ quote, company }: GenerateQuotePDFParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Company Header
      if (company.logo) {
        const logoPath = path.join(process.cwd(), 'public', company.logo);
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 50, 45, { width: 150 });
        }
      }

      doc.font('Helvetica-Bold')
         .fontSize(20)
         .text(company.name, 250, 45);

      // Company Contact Info
      doc.font('Helvetica')
         .fontSize(10)
         .text([
           company.streetAddress,
           `${company.city}, ${company.state} ${company.zipCode}`,
           `Phone: ${company.phone}`,
           `Email: ${company.email}`,
           `Website: ${company.website}`
         ].filter(Boolean).join('\n'), 250, 70);

      // Quote Details
      doc.moveDown(2)
         .font('Helvetica-Bold')
         .fontSize(16)
         .text('QUOTE', { align: 'center' })
         .moveDown(0.5);

      doc.fontSize(10)
         .text(`Quote #: ${quote.number}`, { align: 'right' })
         .text(`Date: ${new Date(quote.createdAt).toLocaleDateString()}`, { align: 'right' })
         .moveDown(2);

      // Client Information
      doc.font('Helvetica-Bold')
         .text('Client Information')
         .font('Helvetica')
         .text([
           `Name: ${quote.clientName}`,
           `Email: ${quote.clientEmail}`,
           `Phone: ${quote.clientPhone}`,
           `Address: ${quote.clientAddress}`
         ].filter(Boolean).join('\n'))
         .moveDown(2);

      // Quote Content
      doc.font('Helvetica-Bold')
         .text('Quote Details')
         .moveDown(0.5);

      const content = JSON.parse(quote.content as string);
      content.forEach((item: any) => {
        doc.font('Helvetica-Bold')
           .text(item.name)
           .font('Helvetica')
           .text(item.description || '')
           .text(`Quantity: ${item.quantity}    Unit Price: $${Number(item.unitPrice).toFixed(2)}    Total: $${Number(item.total).toFixed(2)}`)
           .moveDown(0.5);
      });

      // Financial Summary
      doc.moveDown()
         .font('Helvetica-Bold')
         .text('Financial Summary', { underline: true })
         .moveDown(0.5)
         .font('Helvetica');

      const subtotal = Number(quote.subtotal);
      if (subtotal) {
        doc.text(`Subtotal: $${subtotal.toFixed(2)}`, { align: 'right' });
      }

      if (quote.discountValue) {
        const discountValue = Number(quote.discountValue);
        doc.text(`Discount (${quote.discountType}): $${discountValue.toFixed(2)}`, { align: 'right' });
      }

      if (quote.taxRate) {
        const taxRate = Number(quote.taxRate);
        doc.text(`Tax Rate: ${taxRate}%`, { align: 'right' });
      }

      const total = Number(quote.total);
      doc.font('Helvetica-Bold')
         .text(`Total: $${total.toFixed(2)}`, { align: 'right' })
         .moveDown(2);

      // Payment Terms
      if (quote.downPaymentValue) {
        const downPayment = Number(quote.downPaymentValue);
        const remainingBalance = Number(quote.remainingBalance || 0);
        doc.font('Helvetica')
           .text(`Down Payment Required: $${downPayment.toFixed(2)} (${quote.downPaymentType})`)
           .text(`Remaining Balance: $${remainingBalance.toFixed(2)}`)
           .moveDown();
      }

      // Terms and Conditions
      if (quote.template.termsAndConditions) {
        doc.addPage() // Add a new page for terms
           .font('Helvetica-Bold')
           .fontSize(14)
           .text('Terms and Conditions', { align: 'center' })
           .moveDown()
           .font('Helvetica')
           .fontSize(10)
           .text(quote.template.termsAndConditions, {
             align: 'left',
             columns: 1,
             columnGap: 15,
             height: 700,
             continued: true
           });
      }

      // Signature Section
      if (quote.signature) {
        doc.addPage()
           .font('Helvetica-Bold')
           .text('Signature')
           .moveDown(0.5);

        const signatureData = quote.signature.data;
        if (signatureData) {
          // Convert base64 to image and add to PDF
          const imgBuffer = Buffer.from(signatureData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          doc.image(imgBuffer, { width: 200 });

          doc.moveDown(0.5)
             .font('Helvetica')
             .fontSize(8)
             .text(`Signed by: ${quote.clientName}`)
             .text(`Date: ${new Date(quote.signature.timestamp).toLocaleString()}`)
             .text(`IP Address: ${quote.signature.metadata.ipAddress}`);
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}