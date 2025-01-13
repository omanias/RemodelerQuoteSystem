import PDFDocument from 'pdfkit';
import { Quote, Company, Template } from '@db/schema';
import path from 'path';
import fs from 'fs';

interface Product {
  name: string;
  quantity: number;
  price: number;
}

interface QuoteContent {
  products: Product[];
}

interface GenerateQuotePDFParams {
  quote: Quote & {
    template: Template | null;
    company: Company;
    content: QuoteContent;
  };
  company: Company;
  settings: {
    showUnitPrice: boolean;
    showTotalPrice: boolean;
  };
}

export async function generateQuotePDF({ quote, company, settings }: GenerateQuotePDFParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Create a document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        autoFirstPage: true
      });

      // Collect chunks
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // Header Section
      if (company.logo) {
        try {
          const uploadDir = path.join(process.cwd(), 'uploads');
          const logoPath = path.join(uploadDir, path.basename(company.logo));
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 45, { width: 100 });
          }
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      }

      // Company Info
      doc.font('Helvetica-Bold')
         .fontSize(16)
         .text(company.name || '', 250, 45);

      doc.font('Helvetica')
         .fontSize(10)
         .text([
           company.phone && `Tel: ${company.phone}`,
           company.email,
           company.website
         ].filter(Boolean).join('\n'), 250, 70);

      // Quote Title
      doc.moveDown(4)
         .font('Helvetica-Bold')
         .fontSize(24)
         .text('QUOTE', { align: 'center' })
         .moveDown(0.5);

      // Quote Details
      const quoteDetailsY = doc.y;

      // Client Details
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

      // Quote Info
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

      // Table headers setup
      const tableHeaders = ['Product', 'Quantity'];
      let columnWidths = [200, 80];

      if (settings.showUnitPrice) {
        tableHeaders.push('Unit Price');
        columnWidths.push(80);
      }
      if (settings.showTotalPrice) {
        tableHeaders.push('Total');
        columnWidths.push(75);
      }

      const totalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
      let currentY = tableTop;

      // Draw table header
      const drawTableHeader = (y: number): number => {
        doc.rect(50, y, totalTableWidth, 20)
           .fill('#f3f4f6')
           .stroke('#e5e7eb');

        let xPos = 60;
        tableHeaders.forEach((header, i) => {
          doc.font('Helvetica-Bold')
             .fontSize(10)
             .fillColor('#000000')
             .text(header, xPos, y + 5, {
               width: columnWidths[i],
               align: i >= 1 ? 'right' : 'left'
             });
          xPos += columnWidths[i];
        });
        return y + 25;
      };

      currentY = drawTableHeader(currentY);

      // Products rows
      const products = quote.content?.products || [];
      products.forEach((product, index) => {
        const rowHeight = 30;

        // Check for page break
        if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          currentY = doc.page.margins.top;
          currentY = drawTableHeader(currentY);
        }

        // Row background
        if (index % 2 === 0) {
          doc.rect(50, currentY - 4, totalTableWidth, rowHeight)
             .fill('#f8fafc');
        }

        let xPos = 60;
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#000000');

        // Product name - only show the name without category
        doc.text(product.name, xPos, currentY, { width: columnWidths[0] });

        // Quantity
        xPos += columnWidths[0];
        const quantityText = product.quantity.toString();
        doc.text(quantityText, xPos, currentY, {
          width: columnWidths[1],
          align: 'right'
        });

        // Unit Price
        if (settings.showUnitPrice) {
          xPos += columnWidths[1];
          doc.text(`$${Number(product.price).toFixed(2)}`, xPos, currentY, {
            width: columnWidths[2],
            align: 'right'
          });
        }

        // Total Price
        if (settings.showTotalPrice) {
          xPos += settings.showUnitPrice ? columnWidths[2] : columnWidths[1];
          const total = Number(product.price) * product.quantity;
          doc.text(`$${total.toFixed(2)}`, xPos, currentY, {
            width: settings.showUnitPrice ? columnWidths[3] : columnWidths[2],
            align: 'right'
          });
        }

        currentY += rowHeight;
      });

      // Summary section
      currentY += 20;
      if (currentY + 150 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        currentY = doc.page.margins.top + 20;
      }

      const summaryWidth = 225;
      const summaryX = doc.page.width - doc.page.margins.right - summaryWidth;

      doc.rect(summaryX, currentY, summaryWidth, 120).stroke();

      // Subtotal
      doc.font('Helvetica')
         .fontSize(10)
         .text('Subtotal:', summaryX + 10, currentY + 10)
         .text(`$${Number(quote.subtotal || 0).toFixed(2)}`, summaryX + summaryWidth - 60, currentY + 10, { align: 'right' });

      let summaryY = currentY + 30;

      // Discount
      if (quote.discountValue) {
        const discountLabel = quote.discountType === 'PERCENTAGE' 
          ? `Discount (${quote.discountValue}%):` 
          : 'Discount:';
        doc.text(discountLabel, summaryX + 10, summaryY)
           .text(`-$${Number(quote.discountValue).toFixed(2)}`, summaryX + summaryWidth - 60, summaryY, { align: 'right' });
        summaryY += 20;
      }

      // Tax
      if (quote.taxRate) {
        doc.text(`Tax (${quote.taxRate}%):`, summaryX + 10, summaryY)
           .text(`$${Number(quote.taxAmount || 0).toFixed(2)}`, summaryX + summaryWidth - 60, summaryY, { align: 'right' });
        summaryY += 20;
      }

      // Total
      doc.font('Helvetica-Bold')
         .text('Total:', summaryX + 10, summaryY)
         .text(`$${Number(quote.total || 0).toFixed(2)}`, summaryX + summaryWidth - 60, summaryY, { align: 'right' });

      // Terms & Conditions
      if (quote.template?.termsAndConditions) {
        doc.addPage();
        doc.font('Helvetica-Bold')
           .fontSize(16)
           .text('Terms and Conditions', { align: 'center' })
           .moveDown(1)
           .font('Helvetica')
           .fontSize(11)
           .text(quote.template.termsAndConditions, {
             align: 'justify',
             lineGap: 2
           });
      }

      // Finalize document
      doc.end();
    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(error);
    }
  });
}