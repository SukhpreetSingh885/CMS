import PDFDocument from 'pdfkit';
import { Response } from 'express';

export interface InvoicePdfData {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date | string;
  dueDate: Date | string;
  packageValue: any;
  invoiceAmount: any;
  amountPaid: any;
  remainingBalance: any;
  paymentStatus: string;
  notes?: string | null;
  isCancelled?: boolean;
  cancelReason?: string | null;
  client: {
    id: string;
    companyName: string;
    contactPerson: string;
    contactDesignation?: string | null;
    email: string;
    mobileNumber?: string | null;
    address?: string | null;
    city?: string | null;
    billingCycle?: string;
    package?: {
      name: string;
      packageType?: string;
      description?: string | null;
    } | null;
    services?: Array<{
      service?: {
        name: string;
        description?: string | null;
      } | null;
      monthlyTarget?: number;
    }>;
  };
  payments?: Array<{
    id: string;
    amount: any;
    paymentDate: Date | string;
    paymentMethod: string;
    transactionReference?: string | null;
    isVoided?: boolean;
    receivedBy?: {
      fullName: string;
    } | null;
  }>;
}

export class InvoicePdfService {
  /**
   * Helper to format numbers into INR currency string: INR 50,000.00
   */
  private static formatINR(amount: number | string): string {
    const num = Number(amount || 0);
    return `INR ${num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Format date into clean Indian standard: 12 Oct 2026
   */
  private static formatDate(dateInput: Date | string): string {
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '-';
    }
  }

  /**
   * Build the PDFKit document with the full invoice layout
   */
  public static buildDocument(invoice: InvoicePdfData): typeof PDFDocument {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      info: {
        Title: `Viralstan Invoice ${invoice.invoiceNumber}`,
        Author: 'Viralstan CMS',
        Subject: `Invoice for ${invoice.client.companyName}`,
      },
    });

    const primaryColor = '#6D28D9'; // Brand Purple
    const darkColor = '#0F172A'; // Slate 900
    const mutedColor = '#64748B'; // Slate 500
    const lightBg = '#F8FAFC'; // Slate 50
    const borderColor = '#E2E8F0'; // Slate 200

    // Status colors
    const status = invoice.paymentStatus || 'NOT_DUE';
    let statusBg = '#F1F5F9';
    let statusTextColor = '#475569';
    if (status === 'PAID') {
      statusBg = '#DCFCE7';
      statusTextColor = '#15803D';
    } else if (status === 'PARTIALLY_PAID') {
      statusBg = '#DBEAFE';
      statusTextColor = '#1D4ED8';
    } else if (status === 'OVERDUE') {
      statusBg = '#FEE2E2';
      statusTextColor = '#B91C1C';
    } else if (status === 'CANCELLED' || status === 'VOID' || invoice.isCancelled) {
      statusBg = '#F3F4F6';
      statusTextColor = '#6B7280';
    }

    // -------------------------------------------------------------
    // 1. HEADER SECTION (Brand & Title)
    // -------------------------------------------------------------
    // Top colored brand bar
    doc.rect(40, 40, 515, 4).fill(primaryColor);

    // Brand Name & Tagline
    doc.fillColor(primaryColor).fontSize(22).font('Helvetica-Bold').text('VIRALSTAN', 40, 55);
    doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica').text('Digital Marketing, Performance & Growth Solutions', 40, 80);
    doc.fillColor(mutedColor).fontSize(8).text('Viralstan Media & Technology Pvt. Ltd.', 40, 93);
    doc.text('CIN: U74999DL2024PTC123456 | GSTIN: 07AAACV1234F1Z8', 40, 104);
    doc.text('support@viralstan.com | www.viralstan.com', 40, 115);

    // Right Side: INVOICE Label & Details
    const rightX = 350;
    doc.fillColor(darkColor).fontSize(20).font('Helvetica-Bold').text('TAX INVOICE', rightX, 55, { align: 'right', width: 205 });

    doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text(`Invoice #: ${invoice.invoiceNumber}`, rightX, 80, { align: 'right', width: 205 });
    doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica').text(`Issue Date: ${this.formatDate(invoice.invoiceDate)}`, rightX, 95, { align: 'right', width: 205 });
    doc.text(`Due Date: ${this.formatDate(invoice.dueDate)}`, rightX, 107, { align: 'right', width: 205 });

    // Status Badge Pill on Header
    const badgeW = 100;
    const badgeH = 18;
    const badgeX = 555 - badgeW;
    const badgeY = 122;
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 4).fill(statusBg);
    doc.fillColor(statusTextColor).fontSize(8.5).font('Helvetica-Bold').text(
      invoice.isCancelled ? 'CANCELLED' : status.replace('_', ' '),
      badgeX,
      badgeY + 4,
      { align: 'center', width: badgeW }
    );

    // Horizontal Divider
    doc.rect(40, 146, 515, 1).fill(borderColor);

    // -------------------------------------------------------------
    // 2. BILLED TO & CONTRACT METADATA (Two Columns)
    // -------------------------------------------------------------
    const boxY = 156;
    const boxH = 92;
    const halfW = 252;

    // Left Box: Billed To
    doc.rect(40, boxY, halfW, boxH).fill(lightBg);
    doc.rect(40, boxY, halfW, boxH).strokeColor(borderColor).stroke();

    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('BILLED TO', 50, boxY + 8);
    doc.fillColor(darkColor).fontSize(10.5).font('Helvetica-Bold').text(invoice.client.companyName, 50, boxY + 22, { width: halfW - 20, ellipsis: true });
    doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica');
    doc.text(`Attn: ${invoice.client.contactPerson || '-'}${invoice.client.contactDesignation ? ` (${invoice.client.contactDesignation})` : ''}`, 50, boxY + 38);
    doc.text(`Email: ${invoice.client.email || '-'}`, 50, boxY + 50);
    doc.text(`Phone: ${invoice.client.mobileNumber || '-'}`, 50, boxY + 62);
    const loc = [invoice.client.address, invoice.client.city].filter(Boolean).join(', ') || 'India';
    doc.text(`Location: ${loc}`, 50, boxY + 74, { width: halfW - 20, ellipsis: true });

    // Right Box: Engagement / Contract Details
    const rightBoxX = 40 + halfW + 11;
    doc.rect(rightBoxX, boxY, halfW, boxH).fill(lightBg);
    doc.rect(rightBoxX, boxY, halfW, boxH).strokeColor(borderColor).stroke();

    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('ENGAGEMENT DETAILS', rightBoxX + 10, boxY + 8);
    doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica');
    const billingType = invoice.client.billingCycle
      ? invoice.client.billingCycle.replace('_', ' ')
      : 'Standard';
    doc.text(`Billing Model:`, rightBoxX + 10, boxY + 24);
    doc.fillColor(darkColor).font('Helvetica-Bold').text(billingType, rightBoxX + 90, boxY + 24);

    doc.fillColor(mutedColor).font('Helvetica').text(`Package Plan:`, rightBoxX + 10, boxY + 38);
    const packageName = invoice.client.package?.name || 'Custom Agency Retainer';
    doc.fillColor(darkColor).font('Helvetica-Bold').text(packageName, rightBoxX + 90, boxY + 38, { width: 150, ellipsis: true });

    doc.fillColor(mutedColor).font('Helvetica').text(`Payment Terms:`, rightBoxX + 10, boxY + 52);
    doc.fillColor(darkColor).font('Helvetica-Bold').text('Due Upon Presentation', rightBoxX + 90, boxY + 52);

    doc.fillColor(mutedColor).font('Helvetica').text(`Currency:`, rightBoxX + 10, boxY + 66);
    doc.fillColor(darkColor).font('Helvetica-Bold').text('INR (Indian Rupee - ₹)', rightBoxX + 90, boxY + 66);

    // -------------------------------------------------------------
    // 3. ITEMIZED CHARGES TABLE
    // -------------------------------------------------------------
    let currentY = 258;

    // Table Header
    doc.rect(40, currentY, 515, 22).fill(primaryColor);
    doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
    doc.text('DESCRIPTION / SERVICE SCOPE', 50, currentY + 6, { width: 250 });
    doc.text('BILLING TYPE', 305, currentY + 6, { width: 85, align: 'left' });
    doc.text('TARGET / DELIVERABLES', 395, currentY + 6, { width: 65, align: 'left' });
    doc.text('AMOUNT (INR)', 465, currentY + 6, { width: 80, align: 'right' });

    currentY += 22;

    // Itemized Row 1: Primary Package
    const rowH = 34;
    doc.rect(40, currentY, 515, rowH).fill('#FFFFFF');
    doc.rect(40, currentY, 515, rowH).strokeColor(borderColor).stroke();

    const descTitle = invoice.client.package?.name || 'Professional Digital Marketing & Growth Retainer';
    doc.fillColor(darkColor).fontSize(9).font('Helvetica-Bold').text(descTitle, 50, currentY + 5, { width: 250 });
    const subDesc = invoice.client.package?.description
      ? invoice.client.package.description.slice(0, 90)
      : 'Comprehensive campaign execution, deliverables management, creative assets, and analytics reporting.';
    doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica').text(subDesc, 50, currentY + 17, { width: 250, lineBreak: false, ellipsis: true });

    doc.fillColor(darkColor).fontSize(8.5).font('Helvetica').text(billingType, 305, currentY + 10, { width: 85 });
    doc.text('1 Project/Term', 395, currentY + 10, { width: 65 });
    doc.font('Helvetica-Bold').text(this.formatINR(invoice.invoiceAmount), 465, currentY + 10, { width: 80, align: 'right' });

    currentY += rowH;

    // Display sub-services if available (up to 4)
    if (invoice.client.services && invoice.client.services.length > 0) {
      invoice.client.services.slice(0, 3).forEach((svc, idx) => {
        const sRowH = 20;
        const bg = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        doc.rect(40, currentY, 515, sRowH).fill(bg);
        doc.rect(40, currentY, 515, sRowH).strokeColor(borderColor).stroke();

        doc.fillColor(darkColor).fontSize(8).font('Helvetica').text(`  • ${svc.service?.name || 'Included Marketing Service'}`, 50, currentY + 5, { width: 250, ellipsis: true });
        doc.fillColor(mutedColor).fontSize(7.5).text('Included', 305, currentY + 5);
        doc.text(`${svc.monthlyTarget || 1} Deliverables`, 395, currentY + 5);
        doc.fillColor(mutedColor).text('—', 465, currentY + 5, { width: 80, align: 'right' });

        currentY += sRowH;
      });
    }

    currentY += 10;

    // -------------------------------------------------------------
    // 4. FINANCIAL SUMMARY & PAYMENT INSTRUCTIONS (Side by Side)
    // -------------------------------------------------------------
    const summaryBoxY = currentY;
    const summaryBoxW = 220;
    const summaryBoxX = 555 - summaryBoxW;

    // Right Side: Summary Card
    const cardH = 118;
    doc.rect(summaryBoxX, summaryBoxY, summaryBoxW, cardH).fill(lightBg);
    doc.rect(summaryBoxX, summaryBoxY, summaryBoxW, cardH).strokeColor(borderColor).stroke();

    let sLineY = summaryBoxY + 10;
    // Subtotal
    doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica').text('Subtotal:', summaryBoxX + 12, sLineY);
    doc.fillColor(darkColor).font('Helvetica-Bold').text(this.formatINR(invoice.invoiceAmount), summaryBoxX + 90, sLineY, { width: summaryBoxW - 102, align: 'right' });

    sLineY += 16;
    // Taxes (GST)
    doc.fillColor(mutedColor).font('Helvetica').text('GST (18% Inclusive):', summaryBoxX + 12, sLineY);
    doc.fillColor(darkColor).font('Helvetica-Bold').text('INR 0.00 (Exempt/Incl.)', summaryBoxX + 90, sLineY, { width: summaryBoxW - 102, align: 'right' });

    sLineY += 16;
    // Total Invoice Amount Banner
    doc.rect(summaryBoxX + 6, sLineY - 3, summaryBoxW - 12, 22).fill('#EDE9FE'); // Light violet
    doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold').text('Total Invoice:', summaryBoxX + 12, sLineY + 2);
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text(this.formatINR(invoice.invoiceAmount), summaryBoxX + 90, sLineY + 2, { width: summaryBoxW - 102, align: 'right' });

    sLineY += 26;
    // Total Payments Received
    doc.fillColor('#15803D').fontSize(8.5).font('Helvetica').text('Payments Received:', summaryBoxX + 12, sLineY);
    doc.font('Helvetica-Bold').text(`(-) ${this.formatINR(invoice.amountPaid)}`, summaryBoxX + 90, sLineY, { width: summaryBoxW - 102, align: 'right' });

    sLineY += 18;
    // Remaining Balance
    const balanceNum = Number(invoice.remainingBalance || 0);
    const balanceColor = balanceNum <= 0 ? '#15803D' : '#B91C1C';
    doc.fillColor(balanceColor).fontSize(9.5).font('Helvetica-Bold').text('Remaining Balance:', summaryBoxX + 12, sLineY);
    doc.font('Helvetica-Bold').text(this.formatINR(invoice.remainingBalance), summaryBoxX + 90, sLineY, { width: summaryBoxW - 102, align: 'right' });

    // Left Side: Payment Instructions & Bank Details
    const bankBoxW = 285;
    const bankBoxH = cardH;
    doc.rect(40, summaryBoxY, bankBoxW, bankBoxH).fill(lightBg);
    doc.rect(40, summaryBoxY, bankBoxW, bankBoxH).strokeColor(borderColor).stroke();

    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('PAYMENT INSTRUCTIONS & BANK DETAILS', 50, summaryBoxY + 8);
    doc.fillColor(mutedColor).fontSize(8).font('Helvetica');
    doc.text('Beneficiary Name: ', 50, summaryBoxY + 24);
    doc.fillColor(darkColor).font('Helvetica-Bold').text('Viralstan Media & Technology Pvt Ltd', 130, summaryBoxY + 24);

    doc.fillColor(mutedColor).font('Helvetica').text('Bank & Branch: ', 50, summaryBoxY + 38);
    doc.fillColor(darkColor).font('Helvetica-Bold').text('HDFC Bank Ltd, Connaught Place', 130, summaryBoxY + 38);

    doc.fillColor(mutedColor).font('Helvetica').text('Account Number: ', 50, summaryBoxY + 52);
    doc.fillColor(darkColor).font('Helvetica-Bold').text('50200084729183 (Current)', 130, summaryBoxY + 52);

    doc.fillColor(mutedColor).font('Helvetica').text('IFSC Code: ', 50, summaryBoxY + 66);
    doc.fillColor(darkColor).font('Helvetica-Bold').text('HDFC0001234', 130, summaryBoxY + 66);

    doc.fillColor(mutedColor).font('Helvetica').text('UPI / VPA: ', 50, summaryBoxY + 80);
    doc.fillColor(primaryColor).font('Helvetica-Bold').text('viralstan@hdfcbank', 130, summaryBoxY + 80);

    doc.fillColor('#B45309').fontSize(7.5).font('Helvetica-Oblique').text(
      `* Important: Please quote ${invoice.invoiceNumber} in transaction remarks.`,
      50,
      summaryBoxY + 98
    );

    currentY = summaryBoxY + cardH + 12;

    // -------------------------------------------------------------
    // 5. RECORDED INSTALLMENTS LEDGER (If payments exist)
    // -------------------------------------------------------------
    const activePayments = (invoice.payments || []).filter((p) => !p.isVoided);
    if (activePayments.length > 0) {
      doc.fillColor(darkColor).fontSize(9).font('Helvetica-Bold').text(`RECORDED INSTALLMENT PAYMENTS (${activePayments.length})`, 40, currentY);
      currentY += 13;

      // Small payments table header
      doc.rect(40, currentY, 515, 16).fill('#F1F5F9');
      doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica-Bold');
      doc.text('PAYMENT DATE', 48, currentY + 4, { width: 80 });
      doc.text('METHOD', 135, currentY + 4, { width: 90 });
      doc.text('TRANSACTION REF / UTR', 230, currentY + 4, { width: 140 });
      doc.text('RECORDED BY', 375, currentY + 4, { width: 85 });
      doc.text('AMOUNT (INR)', 465, currentY + 4, { width: 80, align: 'right' });

      currentY += 16;

      activePayments.slice(0, 4).forEach((pmt, pIdx) => {
        const pBg = pIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(40, currentY, 515, 16).fill(pBg);
        doc.rect(40, currentY, 515, 16).strokeColor(borderColor).stroke();

        doc.fillColor(darkColor).fontSize(7.5).font('Helvetica').text(this.formatDate(pmt.paymentDate), 48, currentY + 4, { width: 80 });
        doc.text(pmt.paymentMethod.replace('_', ' '), 135, currentY + 4, { width: 90 });
        doc.text(pmt.transactionReference || 'Direct Remittance', 230, currentY + 4, { width: 140, ellipsis: true });
        doc.text(pmt.receivedBy?.fullName || 'Finance Desk', 375, currentY + 4, { width: 85, ellipsis: true });
        doc.font('Helvetica-Bold').fillColor('#15803D').text(this.formatINR(pmt.amount), 465, currentY + 4, { width: 80, align: 'right' });

        currentY += 16;
      });

      currentY += 8;
    }

    // Cancellation Notice Banner if Voided/Cancelled
    if (invoice.isCancelled || invoice.paymentStatus === 'CANCELLED' || invoice.paymentStatus === 'VOID') {
      doc.rect(40, currentY, 515, 26).fill('#FEF2F2');
      doc.rect(40, currentY, 515, 26).strokeColor('#FCA5A5').stroke();
      doc.fillColor('#B91C1C').fontSize(8.5).font('Helvetica-Bold').text(
        `NOTICE: THIS INVOICE HAS BEEN VOIDED / CANCELLED.`,
        50,
        currentY + 5
      );
      doc.fontSize(7.5).font('Helvetica').text(
        `Reason: ${invoice.cancelReason || 'Administrative cancellation'}. No active receivables due.`,
        50,
        currentY + 15
      );
      currentY += 32;
    }

    // -------------------------------------------------------------
    // 6. NOTES, TERMS & SIGNATURE BLOCK
    // -------------------------------------------------------------
    const termsY = Math.max(currentY, 680);

    if (invoice.notes) {
      doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica-Bold').text('INVOICE NOTES:', 40, termsY - 14);
      doc.fillColor(darkColor).font('Helvetica').text(invoice.notes, 115, termsY - 14, { width: 440, lineBreak: false, ellipsis: true });
    }

    // Terms Left
    doc.fillColor(mutedColor).fontSize(7).font('Helvetica');
    doc.text('Terms & Conditions:', 40, termsY);
    doc.text('1. All payments are non-refundable once deliverables are approved.', 40, termsY + 10);
    doc.text('2. Please notify billing@viralstan.com within 5 business days for discrepancies.', 40, termsY + 19);
    doc.text('3. Late payments may result in pausing ongoing marketing deliverables.', 40, termsY + 28);

    // Signature Block Right
    const sigX = 390;
    doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('VIRALSTAN MANAGEMENT', sigX, termsY, { align: 'right', width: 165 });
    doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica').text('Authorized Financial Desk', sigX, termsY + 12, { align: 'right', width: 165 });
    doc.fontSize(7).text('(Electronically Verified)', sigX, termsY + 24, { align: 'right', width: 165 });

    // -------------------------------------------------------------
    // 7. FOOTER
    // -------------------------------------------------------------
    doc.rect(40, 785, 515, 0.5).fill(borderColor);
    doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica').text(
      'Viralstan Client Management System • Computer-generated legal tax invoice • Page 1 of 1',
      40,
      792,
      { align: 'center', width: 515 }
    );

    return doc;
  }

  /**
   * Stream the generated PDF directly to Express response
   */
  public static async streamToResponse(invoice: InvoicePdfData, res: Response, inline = false): Promise<void> {
    const filename = `Viralstan_Invoice_${invoice.invoiceNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
    );
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    const doc = this.buildDocument(invoice);
    doc.pipe(res);
    doc.end();
  }

  /**
   * Generate PDF buffer (useful for unit tests and attachments)
   */
  public static async generatePdfBuffer(invoice: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = this.buildDocument(invoice);
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err: Error) => reject(err));

      doc.end();
    });
  }
}

