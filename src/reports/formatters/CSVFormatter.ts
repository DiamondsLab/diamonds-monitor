/**
 * CSV Report Formatter
 *
 * Generates CSV reports suitable for data analysis, spreadsheet import,
 * and statistical processing with flattened data structure.
 */

import { MonitoringReport, MonitoringStatus, SeverityLevel } from '../../core/types';
import { ReportFormatter, ReportOptions, ReportValidationResult } from '../types';

/**
 * CSV formatter for data analysis
 */
export class CSVFormatter implements ReportFormatter {
  public readonly id = 'csv';
  public readonly name = 'CSV Report';
  public readonly extension = '.csv';
  public readonly mimeType = 'text/csv';

  /**
   * Format the monitoring report as CSV
   */
  public async format(report: MonitoringReport, options?: ReportOptions): Promise<string> {
    if (options?.compact) {
      return this.generateCompactCSV(report, options);
    } else {
      return this.generateDetailedCSV(report, options);
    }
  }

  /**
   * Validate options for CSV formatting
   */
  public validateOptions(options?: ReportOptions): ReportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Warn about options that don't apply to CSV
    const irrelevantOptions = ['colorOutput', 'interactive', 'theme', 'includeCharts', 'customCss'];
    irrelevantOptions.forEach(option => {
      if (options && (options as any)[option]) {
        warnings.push(`${option} option is ignored for CSV format`);
      }
    });

    return {
      isValid: true,
      errors,
      warnings,
    };
  }

  // Private helper methods

  /**
   * Generate detailed CSV with all information
   */
  private generateDetailedCSV(report: MonitoringReport, options?: ReportOptions): string {
    const rows: string[][] = [];

    // Headers
    const headers = [
      'Report_Timestamp',
      'Diamond_Name',
      'Diamond_Address',
      'Network_Name',
      'Network_ChainId',
      'Overall_Status',
      'Total_Checks',
      'Passed',
      'Failed',
      'Warnings',
      'Skipped',
      'Total_Duration_Ms',
      'Module_Id',
      'Module_Name',
      'Module_Status',
      'Module_Start_Time',
      'Module_End_Time',
      'Module_Duration_Ms',
      'Issue_Count',
      'Issue_Id',
      'Issue_Title',
      'Issue_Description',
      'Issue_Severity',
      'Issue_Category',
      'Issue_Recommendation',
      'Issue_Metadata',
    ];

    if (options?.includeMetadata) {
      headers.push('Module_Metadata');
    }

    rows.push(headers);

    // Data rows
    for (const moduleResult of report.modules) {
      const baseRow = [
        report.timestamp.toISOString(),
        report.diamond.name,
        report.diamond.address,
        report.network.name,
        report.network.chainId.toString(),
        report.summary.status,
        report.summary.totalChecks.toString(),
        report.summary.passed.toString(),
        report.summary.failed.toString(),
        report.summary.warnings.toString(),
        report.summary.skipped.toString(),
        report.duration.toString(),
        moduleResult.moduleId,
        moduleResult.moduleName,
        moduleResult.status,
        moduleResult.startTime.toISOString(),
        moduleResult.endTime.toISOString(),
        moduleResult.duration.toString(),
        moduleResult.result.issues.length.toString(),
      ];

      if (moduleResult.result.issues.length === 0) {
        // No issues - add a row with empty issue fields
        const row = [...baseRow, '', '', '', '', '', '', ''];
        if (options?.includeMetadata) {
          row.push(this.stringifyMetadata(moduleResult.result.metadata));
        }
        rows.push(row);
      } else {
        // Add one row per issue
        for (const issue of moduleResult.result.issues) {
          const row = [
            ...baseRow,
            issue.id,
            issue.title,
            this.escapeCsvField(issue.description),
            issue.severity,
            issue.category,
            this.escapeCsvField(issue.recommendation || ''),
            this.stringifyMetadata(issue.metadata),
          ];

          if (options?.includeMetadata) {
            row.push(this.stringifyMetadata(moduleResult.result.metadata));
          }

          rows.push(row);
        }
      }
    }

    return this.formatCSVRows(rows);
  }

  /**
   * Generate compact CSV focused on issues
   */
  private generateCompactCSV(report: MonitoringReport, options?: ReportOptions): string {
    const sections: string[] = [];

    // Summary section
    sections.push('# SUMMARY');
    sections.push(this.generateSummaryCSV(report));

    // Module performance section
    sections.push('\n# MODULE_PERFORMANCE');
    sections.push(this.generateModulePerformanceCSV(report));

    // Issues section
    const allIssues = report.modules.flatMap(m =>
      m.result.issues.map(issue => ({ ...issue, module: m.moduleName }))
    );

    if (allIssues.length > 0) {
      sections.push('\n# ISSUES');
      sections.push(this.generateIssuesCSV(allIssues, options));
    }

    // Statistics section
    if (options?.includeMetadata) {
      sections.push('\n# STATISTICS');
      sections.push(this.generateStatisticsCSV(report));
    }

    return sections.join('\n');
  }

  /**
   * Generate summary CSV section
   */
  private generateSummaryCSV(report: MonitoringReport): string {
    const headers = ['Metric', 'Value'];
    const rows = [
      headers,
      ['Diamond_Name', report.diamond.name],
      ['Diamond_Address', report.diamond.address],
      ['Network', report.network.name],
      ['Chain_ID', report.network.chainId.toString()],
      ['Status', report.summary.status],
      ['Total_Checks', report.summary.totalChecks.toString()],
      ['Passed', report.summary.passed.toString()],
      ['Failed', report.summary.failed.toString()],
      ['Warnings', report.summary.warnings.toString()],
      ['Skipped', report.summary.skipped.toString()],
      ['Duration_Seconds', (report.duration / 1000).toFixed(2)],
      ['Timestamp', report.timestamp.toISOString()],
    ];

    return this.formatCSVRows(rows);
  }

  /**
   * Generate module performance CSV section
   */
  private generateModulePerformanceCSV(report: MonitoringReport): string {
    const headers = [
      'Module_Name',
      'Module_ID',
      'Status',
      'Duration_Ms',
      'Duration_Seconds',
      'Issue_Count',
      'Start_Time',
      'End_Time',
    ];
    const rows = [headers];

    for (const moduleResult of report.modules) {
      rows.push([
        moduleResult.moduleName,
        moduleResult.moduleId,
        moduleResult.status,
        moduleResult.duration.toString(),
        (moduleResult.duration / 1000).toFixed(2),
        moduleResult.result.issues.length.toString(),
        moduleResult.startTime.toISOString(),
        moduleResult.endTime.toISOString(),
      ]);
    }

    return this.formatCSVRows(rows);
  }

  /**
   * Generate issues CSV section
   */
  private generateIssuesCSV(issues: any[], options?: ReportOptions): string {
    const headers = [
      'Module',
      'Issue_ID',
      'Title',
      'Severity',
      'Category',
      'Description',
      'Recommendation',
      'Has_Metadata',
    ];

    if (options?.includeMetadata) {
      headers.push('Metadata');
    }

    const rows = [headers];

    // Sort issues if specified
    const sortedIssues = this.sortIssues(issues, options?.sortBy);

    // Apply filters
    let filteredIssues = sortedIssues;
    if (options?.severityFilter?.length) {
      filteredIssues = filteredIssues.filter(issue =>
        options.severityFilter!.includes(issue.severity)
      );
    }

    for (const issue of filteredIssues) {
      const row = [
        issue.module,
        issue.id,
        this.escapeCsvField(issue.title),
        issue.severity,
        issue.category,
        this.escapeCsvField(issue.description),
        this.escapeCsvField(issue.recommendation || ''),
        issue.metadata ? 'true' : 'false',
      ];

      if (options?.includeMetadata) {
        row.push(this.stringifyMetadata(issue.metadata));
      }

      rows.push(row);
    }

    return this.formatCSVRows(rows);
  }

  /**
   * Generate statistics CSV section
   */
  private generateStatisticsCSV(report: MonitoringReport): string {
    const allIssues = report.modules.flatMap(m => m.result.issues);

    // Severity distribution
    const severityStats = [
      ['Statistic', 'Value'],
      ['Total_Issues', allIssues.length.toString()],
      [
        'Critical_Issues',
        allIssues.filter(i => i.severity === SeverityLevel.CRITICAL).length.toString(),
      ],
      ['Error_Issues', allIssues.filter(i => i.severity === SeverityLevel.ERROR).length.toString()],
      [
        'Warning_Issues',
        allIssues.filter(i => i.severity === SeverityLevel.WARNING).length.toString(),
      ],
      ['Info_Issues', allIssues.filter(i => i.severity === SeverityLevel.INFO).length.toString()],
    ];

    // Category distribution
    const categoryMap = new Map<string, number>();
    allIssues.forEach(issue => {
      categoryMap.set(issue.category, (categoryMap.get(issue.category) || 0) + 1);
    });

    const categoryStats: string[][] = [
      ['', ''],
      ['# CATEGORY_DISTRIBUTION', ''],
      ['Category', 'Count'],
    ];

    for (const category of Array.from(categoryMap.keys())) {
      const count = categoryMap.get(category)!;
      categoryStats.push([category, count.toString()]);
    }

    // Module statistics
    const moduleStats: string[][] = [
      ['', ''],
      ['# MODULE_STATISTICS', ''],
      ['Module', 'Duration_Ms', 'Issue_Count', 'Issues_Per_Second'],
    ];

    for (const moduleResult of report.modules) {
      const issuesPerSecond =
        moduleResult.duration > 0
          ? (moduleResult.result.issues.length / (moduleResult.duration / 1000)).toFixed(3)
          : '0';

      moduleStats.push([
        moduleResult.moduleName,
        moduleResult.duration.toString(),
        moduleResult.result.issues.length.toString(),
        issuesPerSecond,
      ]);
    }

    return this.formatCSVRows([...severityStats, ...categoryStats, ...moduleStats]);
  }

  /**
   * Sort issues by specified criteria
   */
  private sortIssues(issues: any[], sortBy?: string): any[] {
    const sorted = [...issues];

    switch (sortBy) {
      case 'severity':
        const severityOrder: Record<string, number> = {
          [SeverityLevel.CRITICAL]: 0,
          [SeverityLevel.ERROR]: 1,
          [SeverityLevel.WARNING]: 2,
          [SeverityLevel.INFO]: 3,
        };
        sorted.sort(
          (a, b) => (severityOrder[a.severity] || 999) - (severityOrder[b.severity] || 999)
        );
        break;
      case 'category':
        sorted.sort((a, b) => a.category.localeCompare(b.category));
        break;
      case 'module':
        sorted.sort((a, b) => a.module.localeCompare(b.module));
        break;
      case 'timestamp':
        // Sort by issue ID as proxy for timestamp if no actual timestamp
        sorted.sort((a, b) => a.id.localeCompare(b.id));
        break;
    }

    return sorted;
  }

  /**
   * Format rows as CSV
   */
  private formatCSVRows(rows: string[][]): string {
    return rows.map(row => row.map(cell => this.escapeCSVCell(cell)).join(',')).join('\n');
  }

  /**
   * Escape CSV cell content
   */
  private escapeCSVCell(cell: string): string {
    // Handle null/undefined
    if (cell == null) return '';

    const str = String(cell);

    // If cell contains comma, newline, or double quote, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Escape CSV field content (for description and recommendation fields)
   */
  private escapeCsvField(text: string): string {
    if (!text) return '';

    // Replace newlines with spaces and limit length
    return text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500); // Limit field length for CSV compatibility
  }

  /**
   * Convert metadata object to string
   */
  private stringifyMetadata(metadata: any): string {
    if (!metadata) return '';

    try {
      return JSON.stringify(metadata).replace(/"/g, '""');
    } catch {
      return String(metadata).replace(/"/g, '""');
    }
  }
}
