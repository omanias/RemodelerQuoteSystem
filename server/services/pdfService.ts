import PDFDocument from 'pdfkit';
import { Quote, Company, Template, Category } from '@db/schema';
import path from 'path';
import fs from 'fs';

interface Product {
  name: string;
  description?: string;
  category?: Category;
  variation?: string;
  quantity: number;
  unit?: string;
  price: number;
}

interface QuoteContent {
  products: Product[];
}

interface GenerateQuotePDFParams {
  quote: Quote & {
    template: Template;
    company: Company;
    content: QuoteContent;
  };
  company: Company;
  settings: {
    showUnitPrice: boolean;
    showTotalPrice: boolean;
  };
}

// Helper function to safely format monetary values
function formatMoney(value: string | number | null): string {
  if (value === null) return '-';
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numericValue)) return '-';
  return numericValue.toLocaleString('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export async function generateQuotePDF({ quote, company, settings }: GenerateQuotePDFParams): Promise<Buffer> {
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

      // Quote Details
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

      // Dynamically build headers based on settings
      const tableHeaders = ['Product', 'Description', 'Quantity'];
      let columnWidths = [200, 160, 80]; // Base widths

      if (settings.showUnitPrice) {
        tableHeaders.push('Unit Price');
        columnWidths.push(80);
      }

      if (settings.showTotalPrice) {
        tableHeaders.push('Total');
        columnWidths.push(75);
      }

      const pageHeight = doc.page.height - doc.page.margins.bottom;
      let currentY = tableTop;

      // Table Header
      const drawTableHeader = (y: number): number => {
        const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        doc.rect(50, y, tableWidth, 20).fill('#f3f4f6').stroke('#e5e7eb');
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

      // Parse and group products by category
      const products = quote.content.products || [];
      const productsByCategory = products.reduce<Record<string, Product[]>>((acc, product) => {
        const categoryName = product.category?.name || 'Uncategorized';
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(product);
        return acc;
      }, {});

      // Sort categories alphabetically to ensure consistent order
      const sortedCategories = Object.entries(productsByCategory).sort(([a], [b]) => a.localeCompare(b));

      // Iterate through categories and their products
      sortedCategories.forEach(([categoryName, categoryProducts], categoryIndex) => {
        // Calculate height needed for category header
        const categoryHeaderHeight = 25;

        // Check if we need a new page for the category
        if (currentY + categoryHeaderHeight > pageHeight) {
          doc.addPage();
          currentY = doc.page.margins.top;
          currentY = drawTableHeader(currentY);
        }

        // Draw category header
        const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .text(categoryName, 60, currentY, {
             width: tableWidth - 20,
             align: 'left'
           });

        currentY += categoryHeaderHeight;

        // Process products in this category
        categoryProducts.forEach((product, index) => {
          const productText = product.variation 
            ? `${product.name} (${product.variation})`
            : product.name;

          const descriptionText = product.description || '';
          const quantityText = product.unit
            ? `${product.quantity} ${product.unit}`
            : product.quantity.toString();

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

            // Redraw category header on new page
            doc.font('Helvetica-Bold')
               .fontSize(12)
               .text(categoryName, 60, currentY, {
                 width: tableWidth - 20,
                 align: 'left'
               });
            currentY += categoryHeaderHeight;
          }

          // Draw row background
          const isEvenRow = index % 2 === 0;
          if (isEvenRow) {
            doc.rect(50, currentY - 4, tableWidth, productHeight)
               .fill('#f8fafc');
          }

          // Product details
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

          // Unit Price (if enabled)
          if (settings.showUnitPrice) {
            xPos += columnWidths[2];
            const unitPrice = formatMoney(product.price); // Use formatMoney function
            doc.text(unitPrice, xPos, currentY, {
              width: columnWidths[3],
              align: 'right'
            });
          }

          // Total (if enabled)
          if (settings.showTotalPrice) {
            xPos += (settings.showUnitPrice ? columnWidths[3] : columnWidths[2]);
            const total = Number(product.price) * Number(product.quantity);
            const formattedTotal = formatMoney(total); // Use formatMoney function
            doc.text(formattedTotal, xPos, currentY, {
              width: settings.showUnitPrice ? columnWidths[4] : columnWidths[3],
              align: 'right'
            });
          }

          currentY += productHeight;

          // Add separator line if not the last product in the category
          if (index < categoryProducts.length - 1) {
            doc.strokeColor('#e5e7eb')
               .moveTo(50, currentY - 10)
               .lineTo(50 + tableWidth, currentY - 10)
               .stroke()
               .strokeColor('#000000');
          }
        });

        // Add extra space between categories
        if (categoryIndex < sortedCategories.length - 1) {
          currentY += 15;
        }
      });

      // Financial Summary
      currentY += 20;
      if (currentY + 150 > pageHeight) {
        doc.addPage();
        currentY = doc.page.margins.top + 20;
      }

      // Summary Box
      const summaryWidth = 225;
      const summaryX = doc.page.width - doc.page.margins.right - summaryWidth;

      doc.rect(summaryX, currentY, summaryWidth, 120)
         .stroke();

      // Subtotal
      const subtotal = Number(quote.subtotal || 0);
      doc.font('Helvetica')
         .fontSize(10)
         .text('Subtotal:', summaryX + 10, currentY + 10)
         .text(`$${formatMoney(subtotal)}`, summaryX + summaryWidth - 60, currentY + 10, { align: 'right' });

      let summaryY = currentY + 30;

      // Discount
      if (quote.discountValue) {
        const discountValue = Number(quote.discountValue);
        const discountLabel = quote.discountType === 'PERCENTAGE'
          ? `Discount (${discountValue}%):`
          : 'Discount (fixed):';
        doc.text(discountLabel, summaryX + 10, summaryY)
           .text(`-$${formatMoney(discountValue)}`, summaryX + summaryWidth - 60, summaryY, { align: 'right' });
        summaryY += 20;
      }

      // Tax
      if (quote.taxRate) {
        const taxRate = Number(quote.taxRate);
        const taxAmount = (subtotal * (taxRate / 100));
        doc.text(`Tax (${taxRate}%):`, summaryX + 10, summaryY)
           .text(`$${formatMoney(taxAmount)}`, summaryX + summaryWidth - 60, summaryY, { align: 'right' });
        summaryY += 20;
      }

      // Total
      const total = Number(quote.total || 0);
      doc.font('Helvetica-Bold')
         .text('Total:', summaryX + 10, summaryY)
         .text(`$${formatMoney(total)}`, summaryX + summaryWidth - 60, summaryY, { align: 'right' });

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
             `Down Payment Required: $${formatMoney(downPayment)} (${quote.downPaymentType})`,
             `Remaining Balance: $${formatMoney(remainingBalance)}`
           ].join('\n'));
      }

      // Terms and Conditions Section
      if (quote.template?.termsAndConditions) {
        doc.addPage();
        doc.font('Helvetica-Bold')
           .fontSize(16)
           .text('Terms and Conditions', {
             align: 'center',
             paragraphGap: 15
           })
           .moveDown(1);

        const sections = quote.template.termsAndConditions.split(/\n\s*\n/);
        doc.font('Helvetica')
           .fontSize(11)
           .lineGap(2);

        sections.forEach((section: string, index: number) => {
          const isSectionTitle = section.trim().endsWith(':');
          if (isSectionTitle) {
            doc.font('Helvetica-Bold')
               .text(section.trim(), {
                 align: 'left',
                 paragraphGap: 10
               })
               .font('Helvetica');
          } else {
            doc.text(section.trim(), {
              align: 'justify',
              paragraphGap: 12,
              indent: 20,
              lineGap: 2
            });
          }

          if (index < sections.length - 1) {
            doc.moveDown(0.8);
          }
        });
      }

      // Complete the PDF generation
      doc.end();
    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(error);
    }
  });
}