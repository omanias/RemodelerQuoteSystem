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
        bufferPages: true,
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
      doc.on('data', chunk => {
        chunks.push(Buffer.from(chunk));
      });

      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on('error', (err) => {
        reject(err);
      });

      // Header Section
      const headerTop = 45;
      if (company.logo) {
        try {
          const uploadDir = path.join(process.cwd(), 'uploads');
          const logoPath = path.join(uploadDir, path.basename(company.logo));
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, headerTop, { width: 100 });
          }
        } catch (logoError) {
          console.error('Error loading company logo:', logoError);
        }
      }

      // Company Info
      doc.font('Helvetica-Bold')
         .fontSize(16)
         .text(company.name || '', 250, headerTop);

      const contactInfo = [
        company.phone && `Tel: ${company.phone}`,
        company.email,
        company.website
      ].filter(Boolean);

      doc.font('Helvetica')
         .fontSize(10)
         .text(contactInfo.join('\n'), 250, headerTop + 25);

      // Quote Title
      doc.moveDown(4)
         .font('Helvetica-Bold')
         .fontSize(24)
         .text('QUOTE', { align: 'center' })
         .moveDown(0.5);

      // Quote Details Boxes
      const quoteDetailsY = doc.y;

      // QUOTE TO Box
      doc.rect(50, quoteDetailsY, 250, 100)
         .stroke()
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('QUOTE TO:', 60, quoteDetailsY + 10)
         .font('Helvetica')
         .text([
           quote.clientName,
           quote.clientEmail,
           quote.clientPhone,
           quote.clientAddress
         ].filter(Boolean).join('\n'), 60, quoteDetailsY + 30);

      // QUOTE DETAILS Box
      doc.rect(320, quoteDetailsY, 225, 100)
         .stroke()
         .font('Helvetica-Bold')
         .text('QUOTE DETAILS:', 330, quoteDetailsY + 10)
         .font('Helvetica')
         .text([
           `Quote #: ${quote.number}`,
           `Date: ${new Date(quote.createdAt).toLocaleDateString()}`,
           `Valid Until: ${new Date(new Date(quote.createdAt).setDate(new Date(quote.createdAt).getDate() + 30)).toLocaleDateString()}`
         ].join('\n'), 330, quoteDetailsY + 30);

      // Products Table
      doc.moveDown(4);
      const tableTop = doc.y;
      const tableHeaders = ['Product', 'Description', 'Quantity', 'Unit Price', 'Total'];
      const columnWidths = [150, 140, 70, 70, 65];
      const pageHeight = doc.page.height - doc.page.margins.bottom;
      let currentY = tableTop;

      // Table Header
      const drawTableHeader = (y: number) => {
        doc.rect(50, y, 495, 20).fill('#f3f4f6').stroke('#e5e7eb');
        let xPos = 60;
        tableHeaders.forEach((header, i) => {
          doc.font('Helvetica-Bold')
             .fontSize(10)
             .fillColor('#000000')
             .text(header, xPos, y + 5, {
                width: columnWidths[i],
                align: i >= 2 ? 'right' : 'left'
             });
          xPos += columnWidths[i];
        });
        return y + 25;
      };

      currentY = drawTableHeader(currentY);

      // Get and validate products array
      let products = [];
      try {
        if (typeof quote.content === 'string') {
          const content = JSON.parse(quote.content);
          products = content.products || [];
        } else if (quote.content && Array.isArray(quote.content.products)) {
          products = quote.content.products;
        } else {
          console.warn('No products found in quote content');
          products = [];
        }
      } catch (error) {
        console.error('Error parsing quote content:', error);
        products = [];
      }

      // Products Table Content
      products.forEach((product: any, index: number) => {
        // Log product data for debugging
        console.log(`Processing product ${index}:`, product);

        // Calculate product details
        const productText = product.name || 'Unnamed Product';
        const descriptionText = product.description || '';
        const quantity = parseFloat(product.quantity) || 0;
        const price = parseFloat(product.price) || 0;
        const total = quantity * price;

        const quantityText = product.unit
          ? `${quantity} ${product.unit}`
          : quantity.toString();

        // Calculate required height for this product
        const productHeight = Math.max(
          doc.heightOfString(productText, { width: columnWidths[0] }),
          doc.heightOfString(descriptionText, { width: columnWidths[1] })
        ) + 20; // Add padding

        // Check if we need a new page
        if (currentY + productHeight > pageHeight) {
          doc.addPage();
          currentY = doc.page.margins.top;
          currentY = drawTableHeader(currentY);
        }

        // Draw row background
        const isEvenRow = index % 2 === 0;
        if (isEvenRow) {
          doc.rect(50, currentY - 4, 495, productHeight)
             .fill('#f8fafc');
        }

        // Write product details
        let xPos = 60;
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#000000');

        // Product name
        doc.text(productText, xPos, currentY, { width: columnWidths[0] });

        // Description
        xPos += columnWidths[0];
        doc.text(descriptionText, xPos, currentY, { width: columnWidths[1] });

        // Quantity
        xPos += columnWidths[1];
        doc.text(quantityText, xPos, currentY, {
          width: columnWidths[2],
          align: 'right'
        });

        // Unit Price
        xPos += columnWidths[2];
        doc.text(`$${price.toFixed(2)}`, xPos, currentY, {
          width: columnWidths[3],
          align: 'right'
        });

        // Total
        xPos += columnWidths[3];
        doc.text(`$${total.toFixed(2)}`, xPos, currentY, {
          width: columnWidths[4],
          align: 'right'
        });

        currentY += productHeight;

        // Add separator line
        if (index < products.length - 1) {
          doc.strokeColor('#e5e7eb')
             .moveTo(50, currentY - 10)
             .lineTo(545, currentY - 10)
             .stroke()
             .strokeColor('#000000');
        }
      });

      // Financial Summary
      currentY += 20;
      if (currentY + 150 > pageHeight) {
        doc.addPage();
        currentY = doc.page.margins.top + 20;
      }

      doc.rect(320, currentY, 225, 120)
         .stroke();

      // Subtotal
      const subtotal = Number(quote.subtotal || 0);
      doc.font('Helvetica')
         .fontSize(10)
         .text('Subtotal:', 330, currentY + 10)
         .text(`$${subtotal.toFixed(2)}`, 495, currentY + 10, { align: 'right' });

      let summaryY = currentY + 30;

      // Discount
      if (quote.discountValue) {
        const discountValue = Number(quote.discountValue);
        const discountLabel = quote.discountType === 'PERCENTAGE'
          ? `Discount (${discountValue}%):`
          : 'Discount (fixed):';
        doc.text(discountLabel, 330, summaryY)
           .text(`-$${discountValue.toFixed(2)}`, 495, summaryY, { align: 'right' });
        summaryY += 20;
      }

      // Tax
      if (quote.taxRate) {
        const taxRate = Number(quote.taxRate);
        const taxAmount = (subtotal * (taxRate / 100));
        doc.text(`Tax (${taxRate}%):`, 330, summaryY)
           .text(`$${taxAmount.toFixed(2)}`, 495, summaryY, { align: 'right' });
        summaryY += 20;
      }

      // Total
      const total = Number(quote.total || 0);
      doc.font('Helvetica-Bold')
         .text('Total:', 330, summaryY)
         .text(`$${total.toFixed(2)}`, 495, summaryY, { align: 'right' });

      // Payment Terms (if applicable)
      if (quote.downPaymentValue) {
        summaryY += 40;
        const downPayment = Number(quote.downPaymentValue);
        const remainingBalance = Number(quote.remainingBalance || 0);
        doc.font('Helvetica')
           .fontSize(10)
           .text('Payment Terms:', 50, summaryY)
           .moveDown(0.5)
           .text([
             `Down Payment Required: $${downPayment.toFixed(2)} (${quote.downPaymentType})`,
             `Remaining Balance: $${remainingBalance.toFixed(2)}`
           ].join('\n'));
      }

      // Terms and Conditions (only if provided)
      if (quote.template?.termsAndConditions) {
        doc.addPage()
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
             height: 700
           });
      }

      // Signature Section (if available)
      if (quote.signature) {
        if (doc.y + 200 > pageHeight) {
          doc.addPage();
        } else {
          doc.moveDown(4);
        }

        doc.font('Helvetica-Bold')
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
          }
        }
      }

      try {
        doc.end();
      } catch (endError) {
        console.error('Error ending PDF document:', endError);
        reject(endError);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(error);
    }
  });
}