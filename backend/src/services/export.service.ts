import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Response } from 'express';

export class ExportService {
  /**
   * Export tabular data to Excel
   */
  static async exportToExcel(
    res: Response,
    sheetName: string,
    columns: { header: string; key: string; width?: number }[],
    data: any[],
    filename: string
  ) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Viralstan CMS';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = columns;

    // Header row styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6D28D9' }, // Purple brand accent
    };
    worksheet.getRow(1).height = 24;

    // Add rows
    data.forEach((row) => {
      worksheet.addRow(row);
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Export data summary to PDF
   */
  static exportToPDF(
    res: Response,
    title: string,
    subtitle: string,
    headers: string[],
    rows: (string | number)[][],
    filename: string
  ) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);

    doc.pipe(res);

    // Title and Header
    doc.fontSize(20).fillColor('#6D28D9').text('VIRALSTAN CMS', { align: 'left' });
    doc.fontSize(14).fillColor('#1E293B').text(title, { align: 'left' });
    doc.fontSize(9).fillColor('#64748B').text(subtitle + ` | Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'left' });
    doc.moveDown(1.5);

    // Simple table rendering
    let currentY = doc.y;
    const colWidth = (515 - 20) / headers.length;

    // Table Header
    doc.rect(40, currentY, 515, 20).fill('#6D28D9');
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');

    headers.forEach((h, i) => {
      doc.text(h, 45 + i * colWidth, currentY + 5, { width: colWidth - 5, lineBreak: false, ellipsis: true });
    });

    currentY += 22;
    doc.font('Helvetica').fontSize(8);

    rows.forEach((row, idx) => {
      if (currentY > 750) {
        doc.addPage();
        currentY = 40;
      }

      const bgColor = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
      doc.rect(40, currentY, 515, 18).fill(bgColor);
      doc.fillColor('#1E293B');

      row.forEach((cell, i) => {
        doc.text(String(cell ?? '-'), 45 + i * colWidth, currentY + 4, {
          width: colWidth - 5,
          lineBreak: false,
          ellipsis: true,
        });
      });

      currentY += 19;
    });

    // Footer
    doc.fontSize(8).fillColor('#94A3B8').text(
      'Viralstan Management System — Internal & Confidential',
      40,
      800,
      { align: 'center', width: 515 }
    );

    doc.end();
  }
}
