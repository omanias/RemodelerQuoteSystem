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
      // Create a document with proper settings
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true, // Important for collecting all pages
        autoFirstPage: true,
        info: {
          Title: `Quote ${quote.number}`,
          Author: company.name,
          Subject: 'Quote Document',
          Keywords: 'quote, estimate, proposal',
          CreationDate: new Date()
        }
      });

      // Collect chunks in a buffer
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Professional Header with Logo and Company Info
      const headerTop = 45;
      if (company.logo) {
        try {
          // Check both absolute path and relative to uploads directory
          const uploadDir = path.join(process.cwd(), 'uploads');
          const logoPath = path.join(uploadDir, path.basename(company.logo));

          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, headerTop, { width: 150 });
          } else {
            console.warn(`Company logo not found at path: ${logoPath}`);
          }
        } catch (logoError) {
          console.error('Error loading company logo:', logoError);
          // Continue without the logo
        }
      }

      // Company Info Block
      doc.font('Helvetica-Bold')
         .fontSize(20)
         .text(company.name || '', 250, headerTop);

      // Company Contact Info in a styled block
      const contactInfo = [
        company.streetAddress,
        company.suite ? `Suite ${company.suite}` : null,
        company.city && company.state ? `${company.city}, ${company.state} ${company.zipCode || ''}` : null,
        '',
        company.phone ? `Tel: ${company.phone}` : null,
        company.tollFree ? `Toll Free: ${company.tollFree}` : null,
        company.fax ? `Fax: ${company.fax}` : null,
        company.email,
        company.website
      ].filter(Boolean);

      doc.font('Helvetica')
         .fontSize(10)
         .text(contactInfo.join('\n'), 250, headerTop + 25);

      // Quote Header
      doc.moveDown(4)
         .font('Helvetica-Bold')
         .fontSize(24)
         .text('QUOTE', { align: 'center' })
         .moveDown(0.5);

      // Quote Details Box
      const quoteDetailsY = doc.y;
      doc.rect(50, quoteDetailsY, 250, 80)
         .stroke()
         .fontSize(10)
         .text('QUOTE TO:', 60, quoteDetailsY + 10)
         .font('Helvetica')
         .text([
           quote.clientName,
           quote.clientEmail,
           quote.clientPhone,
           quote.clientAddress
         ].filter(Boolean).join('\n'), 60, quoteDetailsY + 30);

      // Quote Info Box
      doc.rect(320, quoteDetailsY, 225, 80)
         .stroke()
         .font('Helvetica-Bold')
         .text('QUOTE DETAILS:', 330, quoteDetailsY + 10)
         .font('Helvetica')
         .text([
           `Quote #: ${quote.number}`,
           `Date: ${new Date(quote.createdAt).toLocaleDateString()}`,
           `Valid Until: ${new Date(new Date(quote.createdAt).setDate(new Date(quote.createdAt).getDate() + 30)).toLocaleDateString()}`
         ].join('\n'), 330, quoteDetailsY + 30);

      // Move down for content
      doc.moveDown(3);

      // Quote Items Table Header
      const tableTop = doc.y;
      const tableHeaders = ['Product', 'Description', 'Qty', 'Unit Price', 'Total'];
      const columnWidths = [150, 200, 50, 70, 70];

      // Draw table header
      doc.rect(50, tableTop, 495, 20).fill('#f3f4f6').stroke('#e5e7eb');
      let xPos = 60;
      tableHeaders.forEach((header, i) => {
        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fillColor('#000000')
           .text(header, xPos, tableTop + 5, {
              width: columnWidths[i],
              align: i > 1 ? 'right' : 'left'
           });
        xPos += columnWidths[i];
      });

      // Quote Items
      let yPos = tableTop + 25;
      let content;
      try {
        content = typeof quote.content === 'string' ? JSON.parse(quote.content) : quote.content;
      } catch (error) {
        console.error('Error parsing quote content:', error);
        content = [];
      }

      // Draw table lines
      doc.lineWidth(0.5)
         .strokeColor('#e5e7eb');

      if (Array.isArray(content)) {
        content.forEach((item: any, index: number) => {
          // Format the product details with proper units
          const name = item.name || '';
          const unitType = item.unitType || '';
          const description = `Base Price: $${Number(item.basePrice || 0).toFixed(2)}/${unitType}`;
          const quantity = item.quantity?.toString() || '0';
          const unitPrice = Number(item.unitPrice || 0).toFixed(2);
          const total = Number(item.total || 0).toFixed(2);

          const itemHeight = Math.max(
            doc.heightOfString(name, { width: columnWidths[0] }),
            doc.heightOfString(description, { width: columnWidths[1] })
          );

          // Draw row background
          if (index % 2 === 0) {
            doc.rect(50, yPos - 5, 495, itemHeight + 10)
               .fill('#f9fafb');
          }

          xPos = 60;
          doc.font('Helvetica')
             .fontSize(10)
             .fillColor('#000000')
             .text(name, xPos, yPos, { width: columnWidths[0] });

          xPos += columnWidths[0];
          doc.text(description, xPos, yPos, { width: columnWidths[1] });

          xPos += columnWidths[1];
          doc.text(quantity, xPos, yPos, { width: columnWidths[2], align: 'right' });

          xPos += columnWidths[2];
          doc.text(`$${unitPrice}`, xPos, yPos, { width: columnWidths[3], align: 'right' });

          xPos += columnWidths[3];
          doc.text(`$${total}`, xPos, yPos, { width: columnWidths[4], align: 'right' });

          yPos += itemHeight + 10;
        });
      }

      // Financial Summary Box
      doc.rect(320, yPos + 20, 225, 120)
         .stroke();

      const summaryStartY = yPos + 30;
      doc.font('Helvetica')
         .fontSize(10);

      // Subtotal
      const subtotal = Number(quote.subtotal || 0);
      doc.text('Subtotal:', 330, summaryStartY)
         .text(`$${subtotal.toFixed(2)}`, 495, summaryStartY, { align: 'right' });

      // Discount if applicable
      let currentY = summaryStartY + 20;
      if (quote.discountValue) {
        const discountValue = Number(quote.discountValue);
        doc.text(`Discount (${quote.discountType}):`, 330, currentY)
           .text(`-$${discountValue.toFixed(2)}`, 495, currentY, { align: 'right' });
        currentY += 20;
      }

      // Tax if applicable
      if (quote.taxRate) {
        const taxRate = Number(quote.taxRate);
        const taxAmount = (subtotal * (taxRate / 100));
        doc.text(`Tax (${taxRate}%):`, 330, currentY)
           .text(`$${taxAmount.toFixed(2)}`, 495, currentY, { align: 'right' });
        currentY += 20;
      }

      // Total
      const total = Number(quote.total || 0);
      doc.font('Helvetica-Bold')
         .text('Total:', 330, currentY)
         .text(`$${total.toFixed(2)}`, 495, currentY, { align: 'right' });

      // Payment Terms
      if (quote.downPaymentValue) {
        currentY += 20;
        const downPayment = Number(quote.downPaymentValue);
        const remainingBalance = Number(quote.remainingBalance || 0);
        doc.font('Helvetica')
           .fontSize(9)
           .text('Payment Terms:', 50, currentY)
           .moveDown(0.5)
           .text([
             `Down Payment Required: $${downPayment.toFixed(2)} (${quote.downPaymentType})`,
             `Remaining Balance: $${remainingBalance.toFixed(2)}`
           ].join('\n'));
      }

      // Category and Template Information
      if (quote.template?.name) {
        doc.addPage()
           .font('Helvetica-Bold')
           .fontSize(14)
           .text('Project Information', { align: 'center' })
           .moveDown()
           .font('Helvetica')
           .fontSize(12)
           .text(`Template: ${quote.template.name}`)
           .moveDown(0.5);

        if (quote.template?.termsAndConditions) {
          doc.font('Helvetica-Bold')
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
      }

      // Signature Section
      if (quote.signature) {
        doc.addPage()
           .font('Helvetica-Bold')
           .fontSize(14)
           .text('Authorization', { align: 'center' })
           .moveDown()
           .font('Helvetica')
           .fontSize(10)
           .text('By signing below, you agree to the terms and conditions outlined in this quote and authorize the work to proceed.', { align: 'center' })
           .moveDown(2);

        const signatureData = quote.signature.data;
        if (signatureData) {
          try {
            // Convert base64 to image and add to PDF
            const imgBuffer = Buffer.from(signatureData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            doc.image(imgBuffer, { width: 200, align: 'center' });

            doc.moveDown(0.5)
               .fontSize(10)
               .text(`Signed by: ${quote.clientName}`, { align: 'center' })
               .text(`Date: ${new Date(quote.signature.timestamp).toLocaleDateString()}`, { align: 'center' })
               .moveDown(0.5)
               .fontSize(8)
               .fillColor('#666666')
               .text(`Document signed electronically. IP Address: ${quote.signature.metadata.ipAddress}`, { align: 'center' });
          } catch (signatureError) {
            console.error('Error adding signature to PDF:', signatureError);
            // Continue without the signature image
          }
        }
      }

      // Finalize the document
      doc.end();
    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(error);
    }
  });
}