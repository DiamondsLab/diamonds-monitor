/**
 * Types and interfaces for the report generation system
 */

import { MonitoringReport } from '../core/types';

/**
 * Supported report formats
 */
export enum ReportFormat {
  CONSOLE = 'console',
  JSON = 'json',
  HTML = 'html',
  MARKDOWN = 'markdown',
  CSV = 'csv',
}

/**
 * Report generation options
 */
export interface ReportOptions {
  /** Include detailed information in the report */
  includeDetails?: boolean;

  /** Enable color output (for console format) */
  colorOutput?: boolean;

  /** Sort issues by specified criteria */
  sortBy?: 'severity' | 'module' | 'category' | 'timestamp';

  /** Filter issues by severity level */
  severityFilter?: string[];

  /** Filter issues by module */
  moduleFilter?: string[];

  /** Include metadata in the report */
  includeMetadata?: boolean;

  /** Custom title for the report */
  title?: string;

  /** Custom description for the report */
  description?: string;

  /** Include recommendations section */
  includeRecommendations?: boolean;

  /** Maximum number of issues to display per module */
  maxIssuesPerModule?: number;

  /** Theme for HTML reports */
  theme?: 'light' | 'dark' | 'auto';

  /** Include interactive features (for HTML) */
  interactive?: boolean;

  /** Custom CSS for HTML reports */
  customCss?: string;

  /** Include charts and visualizations */
  includeCharts?: boolean;

  /** Compact mode for smaller output */
  compact?: boolean;

  /** Include timestamp in filename */
  timestampInFilename?: boolean;
}

/**
 * Base interface for report formatters
 */
export interface ReportFormatter {
  /** Unique identifier for the formatter */
  readonly id: string;

  /** Human-readable name of the formatter */
  readonly name: string;

  /** File extension for this format */
  readonly extension: string;

  /** MIME type for this format */
  readonly mimeType: string;

  /**
   * Format the monitoring report
   * @param report - The monitoring report to format
   * @param options - Formatting options
   * @returns The formatted report content
   */
  format(report: MonitoringReport, options?: ReportOptions): Promise<string>;

  /**
   * Validate options for this formatter
   * @param options - Options to validate
   * @returns Validation result
   */
  validateOptions(options?: ReportOptions): ReportValidationResult;
}

/**
 * Validation result for report options
 */
export interface ReportValidationResult {
  /** Whether the options are valid */
  isValid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];
}

/**
 * Report generation result
 */
export interface ReportGenerationResult {
  /** Whether the generation was successful */
  success: boolean;

  /** Generated content (if successful) */
  content?: string;

  /** Output file path (if saved) */
  filePath?: string;

  /** Generation time in milliseconds */
  duration: number;

  /** File size in bytes (if saved) */
  fileSize?: number;

  /** Error message (if failed) */
  error?: string;

  /** Warnings during generation */
  warnings: string[];
}

/**
 * Chart data for visualizations
 */
export interface ChartData {
  /** Chart type */
  type: 'pie' | 'bar' | 'line' | 'doughnut';

  /** Chart title */
  title: string;

  /** Data labels */
  labels: string[];

  /** Data values */
  data: number[];

  /** Background colors */
  backgroundColor?: string[];

  /** Border colors */
  borderColor?: string[];
}

/**
 * Theme configuration for reports
 */
export interface ReportTheme {
  /** Primary color */
  primaryColor: string;

  /** Secondary color */
  secondaryColor: string;

  /** Success color */
  successColor: string;

  /** Warning color */
  warningColor: string;

  /** Error color */
  errorColor: string;

  /** Critical color */
  criticalColor: string;

  /** Background color */
  backgroundColor: string;

  /** Text color */
  textColor: string;

  /** Border color */
  borderColor: string;

  /** Font family */
  fontFamily: string;

  /** Font size */
  fontSize: string;
}

/**
 * Predefined themes
 */
export const THEMES: Record<string, ReportTheme> = {
  light: {
    primaryColor: '#1565c0',
    secondaryColor: '#42a5f5',
    successColor: '#2e7d32',
    warningColor: '#f57c00',
    errorColor: '#d32f2f',
    criticalColor: '#b71c1c',
    backgroundColor: '#ffffff',
    textColor: '#212121',
    borderColor: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
  },
  dark: {
    primaryColor: '#64b5f6',
    secondaryColor: '#1976d2',
    successColor: '#4caf50',
    warningColor: '#ff9800',
    errorColor: '#f44336',
    criticalColor: '#d32f2f',
    backgroundColor: '#121212',
    textColor: '#ffffff',
    borderColor: '#333333',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
  },
};
