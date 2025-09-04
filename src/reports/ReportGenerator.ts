/**
 * Main Report Generator for Diamond Monitoring System
 *
 * Orchestrates report generation across multiple formats with professional styling
 * and comprehensive output options.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { MonitoringReport } from '../core/types';
import {
  ReportFormat,
  ReportOptions,
  ReportFormatter,
  ReportGenerationResult,
  ReportValidationResult,
} from './types';

// Import formatters
import { ConsoleFormatter } from './formatters/ConsoleFormatter';
import { JSONFormatter } from './formatters/JSONFormatter';
import { HTMLFormatter } from './formatters/HTMLFormatter';
import { MarkdownFormatter } from './formatters/MarkdownFormatter';
import { CSVFormatter } from './formatters/CSVFormatter';

/**
 * Main report generation orchestrator
 */
export class ReportGenerator {
  private static formatters: Map<ReportFormat, ReportFormatter> = new Map();

  static {
    // Register all formatters
    this.registerFormatter(ReportFormat.CONSOLE, new ConsoleFormatter());
    this.registerFormatter(ReportFormat.JSON, new JSONFormatter());
    this.registerFormatter(ReportFormat.HTML, new HTMLFormatter());
    this.registerFormatter(ReportFormat.MARKDOWN, new MarkdownFormatter());
    this.registerFormatter(ReportFormat.CSV, new CSVFormatter());
  }

  /**
   * Generate a report in the specified format
   * @param report - The monitoring report to format
   * @param format - The desired output format
   * @param outputPath - Optional file path to save the report
   * @param options - Report generation options
   * @returns The generation result
   */
  public static async generateReport(
    report: MonitoringReport,
    format: ReportFormat,
    outputPath?: string,
    options?: ReportOptions
  ): Promise<ReportGenerationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Get the appropriate formatter
      const formatter = this.getFormatter(format);
      if (!formatter) {
        throw new Error(`Unsupported report format: ${format}`);
      }

      // Validate options
      const validation = formatter.validateOptions(options);
      if (!validation.isValid) {
        throw new Error(`Invalid options for ${format} format: ${validation.errors.join(', ')}`);
      }
      warnings.push(...validation.warnings);

      // Apply default options
      const mergedOptions = this.mergeDefaultOptions(options, format);

      // Generate the report content
      const content = await formatter.format(report, mergedOptions);

      // Determine output path if saving
      let finalOutputPath: string | undefined;
      let fileSize: number | undefined;

      if (outputPath) {
        finalOutputPath = this.resolveOutputPath(outputPath, format, mergedOptions);

        // Ensure directory exists
        const dir = path.dirname(finalOutputPath);
        await fs.mkdir(dir, { recursive: true });

        // Save the report
        await this.saveReport(content, finalOutputPath, format);

        // Get file size
        const stats = await fs.stat(finalOutputPath);
        fileSize = stats.size;
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        content,
        filePath: finalOutputPath,
        duration,
        fileSize,
        warnings,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        duration,
        error: (error as Error).message,
        warnings,
      };
    }
  }

  /**
   * Save report content to file
   * @param content - The report content
   * @param outputPath - File path to save to
   * @param format - Report format for proper encoding
   */
  public static async saveReport(
    content: string,
    outputPath: string,
    format: ReportFormat
  ): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });

      // Write the file with appropriate encoding
      await fs.writeFile(outputPath, content, 'utf8');

      // Set appropriate permissions
      await fs.chmod(outputPath, 0o644);
    } catch (error) {
      throw new Error(`Failed to save report to ${outputPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Generate multiple reports in different formats
   * @param report - The monitoring report
   * @param formats - Array of formats to generate
   * @param outputDir - Directory to save reports
   * @param options - Report generation options
   * @returns Array of generation results
   */
  public static async generateMultipleReports(
    report: MonitoringReport,
    formats: ReportFormat[],
    outputDir?: string,
    options?: ReportOptions
  ): Promise<ReportGenerationResult[]> {
    const results: ReportGenerationResult[] = [];

    for (const format of formats) {
      const outputPath = outputDir
        ? path.join(outputDir, this.getDefaultFilename(report, format, options))
        : undefined;

      const result = await this.generateReport(report, format, outputPath, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Get available formatters
   * @returns Array of available format types
   */
  public static getAvailableFormats(): ReportFormat[] {
    return Array.from(this.formatters.keys());
  }

  /**
   * Get formatter information
   * @param format - The format to get info for
   * @returns Formatter information
   */
  public static getFormatterInfo(
    format: ReportFormat
  ): Pick<ReportFormatter, 'id' | 'name' | 'extension' | 'mimeType'> | null {
    const formatter = this.formatters.get(format);
    if (!formatter) return null;

    return {
      id: formatter.id,
      name: formatter.name,
      extension: formatter.extension,
      mimeType: formatter.mimeType,
    };
  }

  /**
   * Validate report options for a specific format
   * @param format - The format to validate options for
   * @param options - Options to validate
   * @returns Validation result
   */
  public static validateOptions(
    format: ReportFormat,
    options?: ReportOptions
  ): ReportValidationResult {
    const formatter = this.getFormatter(format);
    if (!formatter) {
      return {
        isValid: false,
        errors: [`Unsupported format: ${format}`],
        warnings: [],
      };
    }

    return formatter.validateOptions(options);
  }

  /**
   * Register a custom formatter
   * @param format - The format type
   * @param formatter - The formatter implementation
   */
  public static registerFormatter(format: ReportFormat, formatter: ReportFormatter): void {
    this.formatters.set(format, formatter);
  }

  /**
   * Unregister a formatter
   * @param format - The format type to unregister
   */
  public static unregisterFormatter(format: ReportFormat): void {
    this.formatters.delete(format);
  }

  // Private helper methods

  /**
   * Get formatter for a specific format
   */
  private static getFormatter(format: ReportFormat): ReportFormatter | undefined {
    return this.formatters.get(format);
  }

  /**
   * Merge default options with provided options
   */
  private static mergeDefaultOptions(
    options?: ReportOptions,
    format?: ReportFormat
  ): ReportOptions {
    const defaults: ReportOptions = {
      includeDetails: true,
      colorOutput: format === ReportFormat.CONSOLE,
      sortBy: 'severity',
      includeMetadata: true,
      includeRecommendations: true,
      maxIssuesPerModule: 10,
      theme: 'light',
      interactive: format === ReportFormat.HTML,
      includeCharts: format === ReportFormat.HTML,
      compact: false,
      timestampInFilename: false,
    };

    return { ...defaults, ...options };
  }

  /**
   * Resolve the final output path with proper extension and timestamp
   */
  private static resolveOutputPath(
    outputPath: string,
    format: ReportFormat,
    options?: ReportOptions
  ): string {
    const formatter = this.getFormatter(format);
    if (!formatter) {
      throw new Error(`Unknown format: ${format}`);
    }

    let finalPath = outputPath;

    // Add extension if not present
    if (!path.extname(finalPath)) {
      finalPath += formatter.extension;
    }

    // Add timestamp if requested
    if (options?.timestampInFilename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = path.extname(finalPath);
      const base = path.basename(finalPath, ext);
      const dir = path.dirname(finalPath);
      finalPath = path.join(dir, `${base}-${timestamp}${ext}`);
    }

    return finalPath;
  }

  /**
   * Get default filename for a report
   */
  private static getDefaultFilename(
    report: MonitoringReport,
    format: ReportFormat,
    options?: ReportOptions
  ): string {
    const formatter = this.getFormatter(format);
    if (!formatter) {
      throw new Error(`Unknown format: ${format}`);
    }

    const sanitizedDiamondName = report.diamond.name.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedNetworkName = report.network.name.replace(/[^a-zA-Z0-9]/g, '_');

    let basename = `diamond-monitoring-${sanitizedDiamondName}-${sanitizedNetworkName}`;

    // Add timestamp if requested
    if (options?.timestampInFilename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      basename += `-${timestamp}`;
    }

    return basename + formatter.extension;
  }
}
