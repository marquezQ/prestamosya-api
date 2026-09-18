import { Injectable } from '@nestjs/common';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  BORDER,
  COLOR,
  MonthlyPaymentsPdfData,
  PaymentRow,
  PdfMakeInstance,
  ROBOTO_FONTS,
  RowTotals,
} from './pdf-builder.types';
import {
  computeTotals,
  fmt,
  fmtRate,
  fmtShortDate,
  fmtTodayLaPaz,
  truncate,
} from './pdf-formatter.utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const pdfmake: PdfMakeInstance = require('pdfmake');

@Injectable()
export class PdfBuilderService {
  constructor() {
    pdfmake.fonts = ROBOTO_FONTS;
    // Definir políticas de acceso para silenciar advertencias de seguridad en pdfmake 0.3.x
    pdfmake.setUrlAccessPolicy?.(() => false);
    pdfmake.setLocalAccessPolicy?.(() => true);
  }

  /**
   * Genera el PDF de balance mensual de pagos y retorna un Buffer.
   *
   * Formato: Carta (LETTER) en orientación Horizontal (Landscape).
   */
  async buildMonthlyPaymentsPdf(data: MonthlyPaymentsPdfData): Promise<Buffer> {
    const docDefinition = this._buildDocDefinition(data);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    return pdfDoc.getBuffer();
  }

  // ─── Documento principal ────────────────────────────────────────────────────

  private _buildDocDefinition(
    data: MonthlyPaymentsPdfData,
  ): TDocumentDefinitions {
    const content = this._buildContent(data);

    return {
      pageOrientation: 'landscape',
      pageSize: 'LETTER',
      pageMargins: [30, 35, 30, 35],
      defaultStyle: { font: 'Roboto', fontSize: 8, color: '#2d3748' },
      styles: this._buildStyles(),
      content,
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          {
            text: `PrestamosYA — Balance de Pagos ${data.periodLabel}`,
            style: 'footer',
            alignment: 'left',
          },
          {
            text: `Página ${currentPage} de ${pageCount}`,
            style: 'footer',
            alignment: 'right',
          },
        ],
        margin: [30, 0, 30, 0],
      }),
    };
  }

  private _buildContent(
    data: MonthlyPaymentsPdfData,
  ): TDocumentDefinitions['content'] {
    const content: unknown[] = [
      this._buildHeader(data),
      this._buildDividerLine(),
    ];

    const hasBOB = data.rowsBOB.length > 0;
    const hasUSD = data.rowsUSD.length > 0;

    if (!hasBOB && !hasUSD) {
      content.push({
        text: 'No se registraron pagos en el período consultado.',
        style: 'noData',
        marginTop: 30,
      });
    } else {
      if (hasBOB) {
        content.push(
          this._buildCurrencySection(
            'Bolivianos (BOB)',
            'Bs.',
            data.rowsBOB,
            data,
          ),
          { text: '', marginBottom: 20 },
        );
      }
      if (hasUSD) {
        content.push(
          this._buildCurrencySection('Dólares (USD)', '$', data.rowsUSD, data),
        );
      }
    }

    return content as TDocumentDefinitions['content'];
  }

  // ─── Bloques de cabecera ────────────────────────────────────────────────────

  private _buildHeader(data: MonthlyPaymentsPdfData): Record<string, unknown> {
    return {
      columns: [
        {
          stack: [
            { text: 'BALANCE DE PAGOS Y GANANCIAS', style: 'docTitle' },
            { text: `Período: ${data.periodLabel}`, style: 'docSubtitle' },
            { text: `Administrador: ${data.userName}`, style: 'docSubtitle' },
          ],
        },
        {
          stack: [
            { text: 'PrestamosYA', style: 'brandName', alignment: 'right' },
            {
              text: `Generado: ${fmtTodayLaPaz()}`,
              style: 'docMeta',
              alignment: 'right',
            },
            {
              text: `Formato: Carta (Landscape)`,
              style: 'docMeta',
              alignment: 'right',
            },
          ],
        },
      ],
      marginBottom: 12,
    };
  }

  private _buildDividerLine(): Record<string, unknown> {
    return {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 732,
          y2: 0,
          lineWidth: 1.5,
          lineColor: COLOR.headerBg,
        },
      ],
      marginBottom: 12,
    };
  }

  // ─── Sección por moneda ────────────────────────────────────────────────────

  private _buildCurrencySection(
    currencyLabel: string,
    symbol: string,
    rows: PaymentRow[],
    data: MonthlyPaymentsPdfData,
  ): Record<string, unknown> {
    const totals = computeTotals(rows);

    return {
      stack: [
        this._buildSectionHeader(currencyLabel),
        this._buildPaymentsTable(rows, symbol, totals),
        this._buildExecutiveSummaryBox(currencyLabel, symbol, totals, data),
      ],
    };
  }

  private _buildSectionHeader(label: string): Record<string, unknown> {
    return {
      table: {
        widths: ['*'],
        body: [
          [
            {
              text: `● Pagos Registrados en ${label}`,
              style: 'sectionHeader',
              border: BORDER.NONE,
            },
          ],
        ],
      },
      layout: { fillColor: () => COLOR.sectionBg },
      marginBottom: 6,
    };
  }

  // ─── Tabla de pagos (11 Columnas) ─────────────────────────────────────────

  /**
   * Construye la tabla de pagos con 11 columnas detalladas:
   * # | Cliente | Cap. Crédito | Cuota | F. Venc. | F. Pago | Estado | Tasa/Mod. | Pagado | A Capital | A Interés
   */
  private _buildPaymentsTable(
    rows: PaymentRow[],
    symbol: string,
    totals: RowTotals,
  ): Record<string, unknown> {
    return {
      table: {
        headerRows: 1,
        // 11 columnas optimizadas para ancho útil Carta Landscape (732pt)
        widths: [18, 85, 60, 36, 54, 54, 65, 58, 62, 60, 60],
        body: [
          this._buildTableHeader(symbol),
          ...this._buildTableDataRows(rows),
          this._buildTableTotalsRow(totals),
        ],
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 || i === 1 ? 0 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => COLOR.borderColor,
        fillColor: (rowIndex: number) =>
          rowIndex === 0 ? COLOR.headerBg : null,
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      marginBottom: 10,
    };
  }

  private _buildTableHeader(symbol: string): Record<string, unknown>[] {
    const h = (text: string, alignment: string = 'left') => ({
      text,
      style: 'tableHeader',
      alignment,
    });

    return [
      h('#', 'center'),
      h('Cliente'),
      h(`Cap. Crédito (${symbol})`, 'right'),
      h('Cuota', 'center'),
      h('F. Venc.', 'center'),
      h('F. Pago', 'center'),
      h('Cobertura', 'center'),
      h('Tasa / Mod.', 'center'),
      h(`Pagado (${symbol})`, 'right'),
      h(`A Capital (${symbol})`, 'right'),
      h(`A Interés (${symbol})`, 'right'),
    ];
  }

  private _buildTableDataRows(rows: PaymentRow[]): Record<string, unknown>[][] {
    return rows.map((row, idx) => {
      const fillColor = idx % 2 === 1 ? COLOR.bodyAlt : '#ffffff';

      const cell = (
        text: string,
        alignment: 'left' | 'right' | 'center' = 'left',
        extraStyle: Record<string, unknown> = {},
      ) => ({
        text,
        alignment,
        fillColor,
        border: BORDER.BOTTOM,
        borderColor: [
          COLOR.borderColor,
          COLOR.borderColor,
          COLOR.borderColor,
          COLOR.borderColor,
        ],
        ...extraStyle,
      });

      // Badge de Cobertura (Completo vs Abono Parcial)
      const coverageText = row.isPartial ? 'Abono Parcial' : 'Completo';
      const coverageCell = {
        text: coverageText,
        alignment: 'center' as const,
        fontSize: 7,
        bold: true,
        color: row.isPartial ? '#b45309' : '#1d4ed8',
        fillColor: row.isPartial ? '#fef3c7' : '#eff6ff',
        border: BORDER.BOTTOM,
        borderColor: [
          COLOR.borderColor,
          COLOR.borderColor,
          COLOR.borderColor,
          COLOR.borderColor,
        ],
      };

      // Alerta visual en rojo si la fecha de pago fue posterior al vencimiento
      const isLatePayment = row.delayDays > 0;
      const paymentDateCell = cell(fmtShortDate(row.paymentDate), 'center', {
        bold: isLatePayment,
        color: isLatePayment ? '#c5221f' : '#2d3748',
      });

      return [
        cell(String(idx + 1), 'center'),
        cell(truncate(row.clientName, 18)),
        cell(fmt(row.loanCapital), 'right'),
        cell(`${row.installmentNumber}/${row.totalInstallments}`, 'center'),
        cell(fmtShortDate(row.dueDate), 'center'),
        paymentDateCell,
        coverageCell,
        cell(fmtRate(row.interestRate, row.periodType), 'center'),
        cell(fmt(row.amountPaid), 'right'),
        cell(fmt(row.capitalPaid), 'right'),
        cell(fmt(row.interestPaid), 'right', {
          bold: true,
          color: COLOR.profitText,
        }),
      ];
    });
  }

  private _buildTableTotalsRow(totals: RowTotals): Record<string, unknown>[] {
    const BORDER_COLOR = [
      COLOR.headerBg,
      COLOR.headerBg,
      COLOR.headerBg,
      COLOR.headerBg,
    ];

    const totalsCell = (
      text: string,
      extraStyle: Record<string, unknown> = {},
    ) => ({
      text,
      style: 'totalsValue',
      alignment: 'right',
      fillColor: COLOR.totalsBg,
      border: BORDER.TOP_BOTTOM,
      borderColor: BORDER_COLOR,
      ...extraStyle,
    });

    return [
      {
        text: 'TOTALES DEL PERÍODO',
        colSpan: 8,
        style: 'totalsLabel',
        alignment: 'right',
        fillColor: COLOR.totalsBg,
        border: BORDER.TOP_BOTTOM,
        borderColor: BORDER_COLOR,
      },
      { text: '', border: BORDER.NONE },
      { text: '', border: BORDER.NONE },
      { text: '', border: BORDER.NONE },
      { text: '', border: BORDER.NONE },
      { text: '', border: BORDER.NONE },
      { text: '', border: BORDER.NONE },
      { text: '', border: BORDER.NONE },
      totalsCell(fmt(totals.amountPaid)),
      totalsCell(fmt(totals.capitalPaid)),
      totalsCell(fmt(totals.interestPaid), {
        color: COLOR.profitText,
        fontSize: 8.5,
      }),
    ];
  }

  // ─── Resumen Ejecutivo y Auditoría ─────────────────────────────────────────

  /**
   * Caja ejecutiva de ganancias y balance del mes con resaltado visual.
   */
  private _buildExecutiveSummaryBox(
    currencyLabel: string,
    symbol: string,
    totals: RowTotals,
    data: MonthlyPaymentsPdfData,
  ): Record<string, unknown> {
    const isBOB = currencyLabel.includes('BOB');

    const interestCollected = isBOB
      ? data.statsSummary.interestCollectedBOB
      : data.statsSummary.interestCollectedUSD;
    const capitalRecovered = isBOB
      ? data.statsSummary.capitalRecoveredBOB
      : data.statsSummary.capitalRecoveredUSD;
    const totalCashInflow = isBOB
      ? data.statsSummary.totalCashInflowBOB
      : data.statsSummary.totalCashInflowUSD;
    const newCapitalLent = isBOB
      ? data.statsSummary.newCapitalLentBOB
      : data.statsSummary.newCapitalLentUSD;
    const netCashFlow = isBOB
      ? data.statsSummary.netCashFlowBOB
      : data.statsSummary.netCashFlowUSD;

    return {
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                {
                  text: `📊 Balance de Actividad y Ganancias del Mes — ${currencyLabel}`,
                  style: 'summaryTitle',
                  marginBottom: 6,
                },
                {
                  columns: [
                    // Columna Izquierda: Tarjeta destacada de Ganancia por Interés
                    {
                      width: '45%',
                      stack: [
                        {
                          table: {
                            widths: ['*'],
                            body: [
                              [
                                {
                                  stack: [
                                    {
                                      text: 'GANANCIA BRUTA DEL MES (INTERESES)',
                                      fontSize: 7.5,
                                      bold: true,
                                      color: COLOR.profitText,
                                      alignment: 'center',
                                    },
                                    {
                                      text: `${symbol} ${fmt(interestCollected)}`,
                                      fontSize: 14,
                                      bold: true,
                                      color: COLOR.profitText,
                                      alignment: 'center',
                                      marginTop: 2,
                                    },
                                    {
                                      text: `Total de ganancias por intereses cobrados en el mes`,
                                      fontSize: 7,
                                      color: '#4a5568',
                                      alignment: 'center',
                                      marginTop: 2,
                                    },
                                  ],
                                  fillColor: COLOR.profitBg,
                                  border: BORDER.ALL,
                                  borderColor: [
                                    COLOR.profitBorder,
                                    COLOR.profitBorder,
                                    COLOR.profitBorder,
                                    COLOR.profitBorder,
                                  ],
                                  padding: [8, 6, 8, 6],
                                },
                              ],
                            ],
                          },
                          layout: 'noBorders',
                        },
                      ],
                    },
                    // Columna Derecha: Indicadores clave de Actividad y Balance
                    {
                      width: '55%',
                      stack: [
                        this._buildKpiRow(
                          '🏦 Capital Recuperado (Cobrado):',
                          `${symbol} ${fmt(capitalRecovered)}`,
                        ),
                        this._buildKpiRow(
                          '💵 Total Ingresos en Efectivo:',
                          `${symbol} ${fmt(totalCashInflow)}`,
                        ),
                        this._buildKpiRow(
                          '📈 Nuevos Créditos Prestados:',
                          `${symbol} ${fmt(newCapitalLent)}`,
                        ),
                        this._buildKpiRow(
                          '⚖️ Flujo Neto del Mes:',
                          `${symbol} ${fmt(netCashFlow)}`,
                          netCashFlow >= 0 ? '#137333' : '#c5221f',
                        ),
                      ],
                      margin: [15, 0, 0, 0],
                    },
                  ],
                },
              ],
              border: BORDER.ALL,
              borderColor: [
                COLOR.headerBg,
                COLOR.headerBg,
                COLOR.headerBg,
                COLOR.headerBg,
              ],
              fillColor: '#ffffff',
              margin: [8, 8, 8, 8],
            },
          ],
        ],
      },
      layout: 'noBorders',
      marginBottom: 8,
    };
  }

  private _buildKpiRow(
    label: string,
    value: string,
    valueColor: string = '#1a3a5c',
  ): Record<string, unknown> {
    return {
      columns: [
        { text: label, fontSize: 8, color: '#4a5568', alignment: 'left' },
        {
          text: value,
          fontSize: 8.5,
          bold: true,
          color: valueColor,
          alignment: 'right',
        },
      ],
      marginBottom: 3,
    };
  }

  // ─── Estilos del documento ─────────────────────────────────────────────────

  private _buildStyles(): TDocumentDefinitions['styles'] {
    return {
      docTitle: {
        fontSize: 15,
        bold: true,
        color: COLOR.headerBg,
        marginBottom: 2,
      },
      docSubtitle: { fontSize: 8.5, color: '#4a5568', marginBottom: 2 },
      docMeta: { fontSize: 8, color: '#718096' },
      brandName: {
        fontSize: 13,
        bold: true,
        color: COLOR.headerBg,
        marginBottom: 2,
      },
      sectionHeader: {
        fontSize: 9.5,
        bold: true,
        color: COLOR.headerBg,
        margin: [6, 4, 6, 4],
      },
      tableHeader: {
        fontSize: 7.5,
        bold: true,
        color: COLOR.headerText,
        margin: [0, 2, 0, 2],
      },
      totalsLabel: { fontSize: 8, bold: true, color: COLOR.totalsText },
      totalsValue: { fontSize: 8, bold: true, color: COLOR.totalsText },
      summaryTitle: { fontSize: 9, bold: true, color: COLOR.headerBg },
      noData: {
        fontSize: 11,
        italics: true,
        color: '#718096',
        alignment: 'center',
      },
      footer: { fontSize: 7, color: '#a0aec0' },
    };
  }
}
