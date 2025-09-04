/**
 * Console Report Formatter
 *
 * Generates rich, colorful console output with progress indicators,
 * hierarchical display, and professional styling.
 */

import * as chalk from 'chalk';
import { MonitoringReport, MonitoringStatus, SeverityLevel } from '../../core/types';
import { ReportFormatter, ReportOptions, ReportValidationResult } from '../types';

/**
 * Console formatter with rich styling and interactivity
 */
export class ConsoleFormatter implements ReportFormatter {
  public readonly id = 'console';
  public readonly name = 'Console Output';
  public readonly extension = '.txt';
  public readonly mimeType = 'text/plain';

  /**
   * Format the monitoring report for console output
   */
  public async format(report: MonitoringReport, options?: ReportOptions): Promise<string> {
    const output: string[] = [];
    const useColor = options?.colorOutput !== false;
    const c = useColor ? chalk : this.createNoColorChalk();

    // Header section
    output.push(this.generateHeader(report, c, options));

    // Summary section
    output.push(this.generateSummary(report, c, options));

    // Statistics section
    output.push(this.generateStatistics(report, c, options));

    // Module results section
    if (options?.includeDetails !== false) {
      output.push(this.generateModuleResults(report, c, options));
    }

    // Critical issues section
    if (options?.includeDetails) {
      output.push(this.generateCriticalIssues(report, c, options));
    }

    // Recommendations section
    if (options?.includeRecommendations && report.recommendations?.length) {
      output.push(this.generateRecommendations(report, c, options));
    }

    // Footer section
    output.push(this.generateFooter(report, c, options));

    return output.filter(section => section.trim()).join('\n\n');
  }

  /**
   * Validate options for console formatting
   */
  public validateOptions(options?: ReportOptions): ReportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (options?.maxIssuesPerModule !== undefined && options.maxIssuesPerModule < 1) {
      errors.push('maxIssuesPerModule must be at least 1');
    }

    if (
      options?.sortBy &&
      !['severity', 'module', 'category', 'timestamp'].includes(options.sortBy)
    ) {
      errors.push('sortBy must be one of: severity, module, category, timestamp');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Private helper methods

  /**
   * Generate header section
   */
  private generateHeader(report: MonitoringReport, c: any, options?: ReportOptions): string {
    const lines: string[] = [];

    lines.push(c.blue('═'.repeat(80)));
    lines.push(c.blue.bold('              DIAMOND VERIFICATION REPORT              '));
    lines.push(c.blue('═'.repeat(80)));

    return lines.join('\n');
  }

  /**
   * Generate summary section
   */
  private generateSummary(report: MonitoringReport, c: any, options?: ReportOptions): string {
    const lines: string[] = [];

    lines.push(c.cyan('📋 SUMMARY'));
    lines.push(c.cyan('─'.repeat(40)));

    lines.push(`Diamond: ${c.white.bold(report.diamond.name)}`);
    lines.push(`Address: ${c.white(report.diamond.address)}`);
    lines.push(`Network: ${c.white(report.network.name)} (Chain ID: ${report.network.chainId})`);

    if (options?.includeMetadata) {
      lines.push(`Timestamp: ${c.white(report.timestamp.toISOString())}`);
      lines.push(`Duration: ${c.white((report.duration / 1000).toFixed(2))}s`);
    }

    // Status with proper styling
    const statusColor = this.getStatusColor(report.summary.status, c);
    const statusIcon = this.getStatusIcon(report.summary.status);
    lines.push('');
    lines.push(`Status: ${statusColor(`${statusIcon} ${report.summary.status}`)}`);

    return lines.join('\n');
  }

  /**
   * Generate statistics section
   */
  private generateStatistics(report: MonitoringReport, c: any, options?: ReportOptions): string {
    const lines: string[] = [];

    lines.push(c.cyan('📊 STATISTICS'));
    lines.push(c.cyan('─'.repeat(40)));

    lines.push(`Total Checks: ${c.white.bold(report.summary.totalChecks)}`);

    // Visual progress bar for checks
    const passRate =
      report.summary.totalChecks > 0
        ? (report.summary.passed / report.summary.totalChecks) * 100
        : 0;

    if (!options?.compact) {
      lines.push(this.generateProgressBar(passRate, c));
    }

    lines.push(`${c.green('✅ Passed:')} ${report.summary.passed}`);

    if (report.summary.failed > 0) {
      lines.push(`${c.red('❌ Failed:')} ${report.summary.failed}`);
    }

    if (report.summary.warnings > 0) {
      lines.push(`${c.yellow('⚠️  Warnings:')} ${report.summary.warnings}`);
    }

    if (report.summary.skipped > 0) {
      lines.push(`${c.gray('⏭️  Skipped:')} ${report.summary.skipped}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate module results section
   */
  private generateModuleResults(report: MonitoringReport, c: any, options?: ReportOptions): string {
    const lines: string[] = [];

    lines.push(c.cyan('🧩 MODULE RESULTS'));
    lines.push(c.cyan('─'.repeat(40)));

    const maxIssues = options?.maxIssuesPerModule || 10;

    for (const moduleResult of report.modules) {
      const moduleStatusColor = this.getStatusColor(moduleResult.status, c);
      const moduleIcon = this.getStatusIcon(moduleResult.status);

      lines.push('');
      lines.push(`${moduleStatusColor(`${moduleIcon} ${moduleResult.moduleName}`)}`);

      if (!options?.compact) {
        lines.push(`   Duration: ${c.gray((moduleResult.duration / 1000).toFixed(2))}s`);
        lines.push(`   Issues: ${this.getIssueCountText(moduleResult.result.issues.length, c)}`);
      }

      if (moduleResult.result.issues.length > 0) {
        const sortedIssues = this.sortIssues(moduleResult.result.issues, options?.sortBy);
        const issuesToShow = sortedIssues.slice(0, maxIssues);

        for (const issue of issuesToShow) {
          const issueColor = this.getSeverityColor(issue.severity, c);
          const issueIcon = this.getSeverityIcon(issue.severity);
          lines.push(`     ${issueColor(`${issueIcon} ${issue.title}`)}`);

          if (options?.includeDetails && !options?.compact) {
            lines.push(`       ${c.gray(this.truncateText(issue.description, 80))}`);
          }
        }

        if (moduleResult.result.issues.length > maxIssues) {
          const remaining = moduleResult.result.issues.length - maxIssues;
          lines.push(
            `     ${c.gray(`... and ${remaining} more issue${remaining === 1 ? '' : 's'}`)}`
          );
        }
      }

      // Show metadata if available and detailed
      if (options?.includeMetadata && moduleResult.result.metadata && !options?.compact) {
        const metadata = moduleResult.result.metadata;
        Object.entries(metadata).forEach(([key, value]) => {
          if (typeof value === 'number' || typeof value === 'string') {
            lines.push(`   ${c.dim(`${key}: ${value}`)}`);
          }
        });
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate critical issues section
   */
  private generateCriticalIssues(
    report: MonitoringReport,
    c: any,
    options?: ReportOptions
  ): string {
    const allIssues = report.modules.flatMap(m => m.result.issues);
    const criticalIssues = allIssues.filter(i => i.severity === SeverityLevel.CRITICAL);
    const errorIssues = allIssues.filter(i => i.severity === SeverityLevel.ERROR);

    if (criticalIssues.length === 0 && errorIssues.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push(c.red('🚨 CRITICAL & ERROR ISSUES'));
    lines.push(c.red('─'.repeat(40)));

    const highPriorityIssues = [...criticalIssues, ...errorIssues];

    highPriorityIssues.forEach((issue, index) => {
      const issueColor = this.getSeverityColor(issue.severity, c);
      const issueIcon = this.getSeverityIcon(issue.severity);

      lines.push('');
      lines.push(`${index + 1}. ${issueColor(`${issueIcon} ${issue.title}`)}`);
      lines.push(`   Category: ${c.dim(issue.category)}`);
      lines.push(`   ${this.wrapText(issue.description, 77, '   ')}`);

      if (issue.recommendation) {
        lines.push(
          `   ${c.blue('💡 Recommendation:')} ${this.wrapText(issue.recommendation, 60, '      ')}`
        );
      }

      if (issue.metadata && options?.includeMetadata) {
        lines.push(
          `   ${c.dim('Metadata: ' + JSON.stringify(issue.metadata, null, 2).replace(/\n/g, '\n   '))}`
        );
      }
    });

    return lines.join('\n');
  }

  /**
   * Generate recommendations section
   */
  private generateRecommendations(
    report: MonitoringReport,
    c: any,
    options?: ReportOptions
  ): string {
    if (!report.recommendations?.length) return '';

    const lines: string[] = [];
    lines.push(c.blue('💡 RECOMMENDATIONS'));
    lines.push(c.blue('─'.repeat(40)));

    report.recommendations.forEach((recommendation, index) => {
      lines.push(`${index + 1}. ${this.wrapText(recommendation, 75, '   ')}`);
    });

    return lines.join('\n');
  }

  /**
   * Generate footer section
   */
  private generateFooter(report: MonitoringReport, c: any, options?: ReportOptions): string {
    const lines: string[] = [];

    lines.push(c.blue('═'.repeat(80)));

    // Success message based on status
    switch (report.summary.status) {
      case MonitoringStatus.PASS:
        lines.push(c.green('✅ Diamond monitoring completed successfully'));
        break;
      case MonitoringStatus.WARNING:
        lines.push(c.yellow('⚠️  Diamond monitoring completed with warnings'));
        break;
      case MonitoringStatus.FAIL:
        lines.push(c.red('❌ Diamond monitoring found critical issues'));
        break;
      default:
        lines.push(c.gray('ℹ️  Diamond monitoring completed'));
    }

    if (!options?.compact) {
      const moduleCount = report.modules.length;
      const passedModules = report.modules.filter(m => m.status === MonitoringStatus.PASS).length;
      lines.push('');
      lines.push(c.gray(`Monitoring completed - ${passedModules}/${moduleCount} modules passed`));
    }

    return lines.join('\n');
  }

  // Utility methods

  /**
   * Generate a progress bar
   */
  private generateProgressBar(percentage: number, c: any, width: number = 40): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    const color = percentage >= 80 ? c.green : percentage >= 60 ? c.yellow : c.red;
    return `Progress: [${color(bar)}] ${percentage.toFixed(1)}%`;
  }

  /**
   * Get color for status
   */
  private getStatusColor(status: MonitoringStatus, c: any): any {
    switch (status) {
      case MonitoringStatus.PASS:
        return c.green.bold;
      case MonitoringStatus.WARNING:
        return c.yellow.bold;
      case MonitoringStatus.FAIL:
        return c.red.bold;
      case MonitoringStatus.SKIPPED:
        return c.gray.bold;
      default:
        return c.white.bold;
    }
  }

  /**
   * Get icon for status
   */
  private getStatusIcon(status: MonitoringStatus): string {
    switch (status) {
      case MonitoringStatus.PASS:
        return '✅';
      case MonitoringStatus.WARNING:
        return '⚠️';
      case MonitoringStatus.FAIL:
        return '❌';
      case MonitoringStatus.SKIPPED:
        return '⏭️';
      default:
        return 'ℹ️';
    }
  }

  /**
   * Get color for severity
   */
  private getSeverityColor(severity: SeverityLevel, c: any): any {
    switch (severity) {
      case SeverityLevel.CRITICAL:
        return c.red.bold;
      case SeverityLevel.ERROR:
        return c.red;
      case SeverityLevel.WARNING:
        return c.yellow;
      case SeverityLevel.INFO:
        return c.blue;
      default:
        return c.gray;
    }
  }

  /**
   * Get icon for severity
   */
  private getSeverityIcon(severity: SeverityLevel): string {
    switch (severity) {
      case SeverityLevel.CRITICAL:
        return '🚨';
      case SeverityLevel.ERROR:
        return '❌';
      case SeverityLevel.WARNING:
        return '⚠️';
      case SeverityLevel.INFO:
        return 'ℹ️';
      default:
        return '•';
    }
  }

  /**
   * Get issue count text with appropriate color
   */
  private getIssueCountText(count: number, c: any): string {
    if (count === 0) return c.green('0');
    if (count <= 3) return c.yellow(count.toString());
    return c.red(count.toString());
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
        // Keep original order since they're already grouped by module
        break;
    }

    return sorted;
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Wrap text to specified width with indentation
   */
  private wrapText(text: string, width: number, indent: string = ''): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length > width) {
        if (currentLine) {
          lines.push(indent + currentLine.trim());
          currentLine = '';
        }
      }
      currentLine += word + ' ';
    }

    if (currentLine.trim()) {
      lines.push(indent + currentLine.trim());
    }

    return lines.join('\n');
  }

  /**
   * Create no-color chalk replacement
   */
  private createNoColorChalk(): any {
    const identity = (text: string) => text;
    const boldIdentity = Object.assign(identity, { bold: identity });

    return new Proxy(
      {},
      {
        get: () =>
          new Proxy(boldIdentity, {
            get: () => identity,
            apply: (target, thisArg, args) => args[0] || '',
          }),
      }
    );
  }
}
