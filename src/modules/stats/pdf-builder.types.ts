import type { TFontDictionary } from 'pdfmake/interfaces';
import * as path from 'path';

// ─── Interfaces para pdfmake (Node.js / 0.3.x) ───────────────────────────────
//
// @types/pdfmake contempla la API de browser tradicional.
// En pdfmake 0.3.x, require('pdfmake') expone la instancia principal con .fonts
// y .createPdf(docDef).getBuffer() que retorna Promise<Buffer>.

/** Contrato para la instancia principal de pdfmake en Node.js */
export interface PdfMakeInstance {
  fonts: TFontDictionary;
  createPdf(docDefinition: object): {
    getBuffer(): Promise<Buffer>;
  };
}

// ─── Tipos de dominio del PDF ─────────────────────────────────────────────────

/**
 * Datos de una fila del balance: representa un pago aplicado a una cuota.
 * Contiene toda la información necesaria para las 9 columnas del reporte.
 */
export interface PaymentRow {
  /** Número de la cuota del cronograma */
  installmentNumber: number;
  /** Monto total de la cuota según el cronograma */
  installmentTotal: number;
  /** Capital total original del préstamo (para identificar de qué crédito es) */
  loanCapital: number;
  /** Nombre completo del cliente */
  clientName: string;
  /** Tasa de interés del préstamo (ej: 10) */
  interestRate: number;
  /** Modalidad del período (ej: 'monthly', 'weekly') */
  periodType: string | null;
  /** Monto total pagado en este pago */
  amountPaid: number;
  /** Porción del pago que fue a capital */
  capitalPaid: number;
  /** Porción del pago que fue a interés (Ganancia) */
  interestPaid: number;
  /** Fecha de vencimiento programada de la cuota */
  dueDate: Date;
  /** Fecha real en la que se realizó el pago */
  paymentDate: Date;
  /** Días de retraso (0 si pagó a tiempo o antes) */
  delayDays: number;
}

/** Resumen de métricas de rendimiento y balance del mes. */
export interface MonthlyStatsSummary {
  interestCollectedBOB: number;
  interestCollectedUSD: number;
  capitalRecoveredBOB: number;
  capitalRecoveredUSD: number;
  totalCashInflowBOB: number;
  totalCashInflowUSD: number;
  newCapitalLentBOB: number;
  newCapitalLentUSD: number;
  netCashFlowBOB: number;
  netCashFlowUSD: number;
  totalPaymentsCount: number;
}

/**
 * Datos consolidados para construir el PDF completo de un mes.
 */
export interface MonthlyPaymentsPdfData {
  /** Nombre del usuario administrador */
  userName: string;
  /** Año del período */
  year: number;
  /** Mes del período (1–12) */
  month: number;
  /** Etiqueta del período en español (ej: "Septiembre 2026") */
  periodLabel: string;
  /** Pagos en bolivianos */
  rowsBOB: PaymentRow[];
  /** Pagos en dólares */
  rowsUSD: PaymentRow[];
  /** Resumen de estadísticas del mes */
  statsSummary: MonthlyStatsSummary;
}

/** Totales financieros acumulados de un conjunto de filas. */
export interface RowTotals {
  amountPaid: number;
  capitalPaid: number;
  interestPaid: number;
}

// ─── Constantes de presentación ───────────────────────────────────────────────

/** Paleta de colores del reporte. Centralizados para facilitar cambios de marca. */
export const COLOR = {
  headerBg: '#1a3a5c',
  headerText: '#ffffff',
  totalsBg: '#e8f0fe',
  totalsText: '#1a3a5c',
  sectionBg: '#f0f4f8',
  borderColor: '#cbd5e0',
  bodyAlt: '#f8fafc',
  summaryBg: '#ffffff',
  // Colores para resaltados y badges de estado
  profitBg: '#e6f4ea',
  profitText: '#137333',
  profitBorder: '#a8dab5',
  onTimeBg: '#e6f4ea',
  onTimeText: '#137333',
  delayedBg: '#fce8e6',
  delayedText: '#c5221f',
  kpiBg: '#f1f5f9',
} as const;

/** Tipos de borde reutilizables para celdas de tabla de pdfmake. */
export const BORDER = {
  NONE: [false, false, false, false] as [boolean, boolean, boolean, boolean],
  BOTTOM: [false, false, false, true] as [boolean, boolean, boolean, boolean],
  TOP_BOTTOM: [false, true, false, true] as [
    boolean,
    boolean,
    boolean,
    boolean,
  ],
  ALL: [true, true, true, true] as [boolean, boolean, boolean, boolean],
} as const;

/**
 * Ruta a las fuentes Roboto incluidas en el paquete pdfmake.
 * Se resuelve desde __dirname relativo al archivo compilado en dist/.
 */
const FONTS_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'node_modules',
  'pdfmake',
  'build',
  'fonts',
  'Roboto',
);

/** Diccionario de fuentes Roboto para el constructor de PdfPrinter. */
export const ROBOTO_FONTS: TFontDictionary = {
  Roboto: {
    normal: path.join(FONTS_PATH, 'Roboto-Regular.ttf'),
    bold: path.join(FONTS_PATH, 'Roboto-Medium.ttf'),
    italics: path.join(FONTS_PATH, 'Roboto-Italic.ttf'),
    bolditalics: path.join(FONTS_PATH, 'Roboto-MediumItalic.ttf'),
  },
};
