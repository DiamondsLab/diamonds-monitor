/**
 * Markdown Report Formatter
 *
 * Generates GitHub-compatible Markdown reports with proper formatting,
 * tables, code blocks, and documentation-friendly structure.
 */

import { MonitoringReport, MonitoringStatus, SeverityLevel } from '../../core/types';
import { ReportFormatter, ReportOptions, ReportValidationResult } from '../types';

/**
 * Markdown formatter for documentation-friendly reports
 */
export class MarkdownFormatter implements ReportFormatter {
  public readonly id = 'markdown';
  public readonly name = 'Markdown Report';
  public readonly extension = '.md';
  public readonly mimeType = 'text/markdown';

  /**
   * Format the monitoring report as Markdown
   */
  public async format(report: MonitoringReport, options?: ReportOptions): Promise<string> {
    const sections: string[] = [];

    // Title and metadata
    sections.push(this.generateTitle(report, options));
    sections.push(this.generateTOC(report, options));
    sections.push(this.generateSummary(report, options));
    sections.push(this.generateOverview(report, options));

    // Module results
    sections.push(this.generateModuleResults(report, options));

    // Detailed issues
    if (options?.includeDetails) {
      sections.push(this.generateDetailedIssues(report, options));
    }

    // Recommendations
    if (options?.includeRecommendations && report.recommendations?.length) {
      sections.push(this.generateRecommendations(report, options));
    }

    // Appendix
    if (options?.includeMetadata) {
      sections.push(this.generateAppendix(report, options));
    }

    return sections.filter(section => section.trim()).join('\n\n');
  }

  /**
   * Validate options for Markdown formatting
   */
  public validateOptions(options?: ReportOptions): ReportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Warn about options that don't apply to Markdown
    const irrelevantOptions = ['colorOutput', 'interactive', 'theme', 'includeCharts', 'customCss'];
    irrelevantOptions.forEach(option => {
      if (options && (options as any)[option]) {
        warnings.push(`${option} option is ignored for Markdown format`);
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
   * Generate title and header
   */
  private generateTitle(report: MonitoringReport, options?: ReportOptions): string {
    const title = options?.title || `Diamond Monitoring Report`;
    const statusBadge = this.getStatusBadge(report.summary.status);
    const timestamp = options?.includeMetadata ? ` - ${report.timestamp.toLocaleDateString()}` : '';

    return `# ${title}${timestamp}

${statusBadge}

**Diamond:** ${report.diamond.name}  
**Address:** \`${report.diamond.address}\`  
**Network:** ${report.network.name} (Chain ID: ${report.network.chainId})  
${options?.includeMetadata ? `**Generated:** ${new Date().toISOString()}  \n**Duration:** ${(report.duration / 1000).toFixed(2)}s` : ''}

---`;
  }

  /**
   * Generate table of contents
   */
  private generateTOC(report: MonitoringReport, options?: ReportOptions): string {
    const sections: string[] = [
      '- [Summary](#summary)',
      '- [Overview](#overview)',
      '- [Module Results](#module-results)',
    ];

    if (options?.includeDetails) {
      sections.push('- [Detailed Issues](#detailed-issues)');
    }

    if (options?.includeRecommendations && report.recommendations?.length) {
      sections.push('- [Recommendations](#recommendations)');
    }

    if (options?.includeMetadata) {
      sections.push('- [Technical Details](#technical-details)');
    }

    return `## Table of Contents

${sections.join('\n')}

---`;
  }

  /**
   * Generate summary section
   */
  private generateSummary(report: MonitoringReport, options?: ReportOptions): string {
    const passRate =
      report.summary.totalChecks > 0
        ? ((report.summary.passed / report.summary.totalChecks) * 100).toFixed(1)
        : '0';

    return `## Summary

| Metric | Value |
|--------|-------|
| **Overall Status** | ${this.getStatusBadge(report.summary.status)} |
| **Total Checks** | ${report.summary.totalChecks} |
| **Passed** | ${report.summary.passed} ✅ |
| **Failed** | ${report.summary.failed} ❌ |
| **Warnings** | ${report.summary.warnings} ⚠️ |
| **Skipped** | ${report.summary.skipped} ⏭️ |
| **Pass Rate** | ${passRate}% |

${this.generateProgressBar(parseFloat(passRate))}`;
  }

  /**
   * Generate overview section
   */
  private generateOverview(report: MonitoringReport, options?: ReportOptions): string {
    const allIssues = report.modules.flatMap(m => m.result.issues);
    const criticalIssues = allIssues.filter(i => i.severity === SeverityLevel.CRITICAL).length;
    const errorIssues = allIssues.filter(i => i.severity === SeverityLevel.ERROR).length;
    const warningIssues = allIssues.filter(i => i.severity === SeverityLevel.WARNING).length;
    const infoIssues = allIssues.filter(i => i.severity === SeverityLevel.INFO).length;

    let overview = `## Overview

This report provides a comprehensive analysis of the ${report.diamond.name} diamond contract deployed on ${report.network.name}.

### Key Findings

`;

    if (criticalIssues > 0) {
      overview += `- 🚨 **${criticalIssues} Critical Issue${criticalIssues === 1 ? '' : 's'}** requiring immediate attention\n`;
    }

    if (errorIssues > 0) {
      overview += `- ❌ **${errorIssues} Error${errorIssues === 1 ? '' : 's'}** that should be addressed\n`;
    }

    if (warningIssues > 0) {
      overview += `- ⚠️ **${warningIssues} Warning${warningIssues === 1 ? '' : 's'}** for consideration\n`;
    }

    if (infoIssues > 0) {
      overview += `- ℹ️ **${infoIssues} Informational item${infoIssues === 1 ? '' : 's'}**\n`;
    }

    if (criticalIssues === 0 && errorIssues === 0) {
      overview += `- ✅ **No critical or error issues detected**\n`;
    }

    // Module performance summary
    const moduleTable = this.generateModulePerformanceTable(report);
    overview += `\n### Module Performance\n\n${moduleTable}`;

    return overview;
  }

  /**
   * Generate module results section
   */
  private generateModuleResults(report: MonitoringReport, options?: ReportOptions): string {
    const maxIssues = options?.maxIssuesPerModule || 10;
    let content = `## Module Results

Each module performs specific monitoring tasks. Below are the detailed results:

`;

    for (const moduleResult of report.modules) {
      const statusIcon = this.getStatusIcon(moduleResult.status);
      const duration = (moduleResult.duration / 1000).toFixed(2);
      const issueCount = moduleResult.result.issues.length;

      content += `### ${statusIcon} ${moduleResult.moduleName}

**Status:** ${this.getStatusBadge(moduleResult.status)}  
**Duration:** ${duration}s  
**Issues Found:** ${issueCount}

`;

      if (issueCount > 0) {
        const issues = moduleResult.result.issues.slice(0, maxIssues);

        content += `#### Issues\n\n`;

        for (let i = 0; i < issues.length; i++) {
          const issue = issues[i];
          const severityIcon = this.getSeverityIcon(issue.severity);

          content += `${i + 1}. **${severityIcon} ${issue.title}** (\`${issue.severity}\`)
   
   ${issue.description}
   
`;

          if (issue.recommendation) {
            content += `   > 💡 **Recommendation:** ${issue.recommendation}
   
`;
          }

          if (options?.includeMetadata && issue.metadata) {
            content += `   <details>
   <summary>Technical Details</summary>
   
   \`\`\`json
   ${JSON.stringify(issue.metadata, null, 2)}
   \`\`\`
   </details>
   
`;
          }
        }

        if (moduleResult.result.issues.length > maxIssues) {
          const remaining = moduleResult.result.issues.length - maxIssues;
          content += `<details>
<summary>Show ${remaining} more issue${remaining === 1 ? '' : 's'}...</summary>

${moduleResult.result.issues
  .slice(maxIssues)
  .map((issue, index) => {
    const severityIcon = this.getSeverityIcon(issue.severity);
    return `${maxIssues + index + 1}. **${severityIcon} ${issue.title}** (\`${issue.severity}\`)
   
   ${issue.description}
   
   ${issue.recommendation ? `> 💡 **Recommendation:** ${issue.recommendation}\n\n` : ''}`;
  })
  .join('')}
</details>

`;
        }
      } else {
        content += `✅ No issues detected in this module.

`;
      }

      // Module metadata
      if (options?.includeMetadata && moduleResult.result.metadata) {
        content += `<details>
<summary>Module Metadata</summary>

\`\`\`json
${JSON.stringify(moduleResult.result.metadata, null, 2)}
\`\`\`
</details>

`;
      }

      content += '---\n\n';
    }

    return content;
  }

  /**
   * Generate detailed issues section
   */
  private generateDetailedIssues(report: MonitoringReport, options?: ReportOptions): string {
    const allIssues = report.modules.flatMap(m =>
      m.result.issues.map(issue => ({ ...issue, module: m.moduleName }))
    );

    if (allIssues.length === 0) {
      return `## Detailed Issues

✅ **No issues were detected during the monitoring process.**`;
    }

    // Group by severity
    const severityGroups = {
      [SeverityLevel.CRITICAL]: allIssues.filter(i => i.severity === SeverityLevel.CRITICAL),
      [SeverityLevel.ERROR]: allIssues.filter(i => i.severity === SeverityLevel.ERROR),
      [SeverityLevel.WARNING]: allIssues.filter(i => i.severity === SeverityLevel.WARNING),
      [SeverityLevel.INFO]: allIssues.filter(i => i.severity === SeverityLevel.INFO),
    };

    let content = `## Detailed Issues

This section provides comprehensive details about all identified issues, organized by severity level.

`;

    for (const [severity, issues] of Object.entries(severityGroups)) {
      if (issues.length === 0) continue;

      const severityIcon = this.getSeverityIcon(severity as SeverityLevel);
      const severityName = severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();

      content += `### ${severityIcon} ${severityName} Issues (${issues.length})

`;

      // Sort issues by module
      const sortedIssues = this.sortIssues(issues, options?.sortBy);

      for (let i = 0; i < sortedIssues.length; i++) {
        const issue = sortedIssues[i];

        content += `#### ${i + 1}. ${issue.title}

**Module:** ${issue.module}  
**Category:** \`${issue.category}\`  
**Severity:** ${this.getSeverityBadge(issue.severity)}

${issue.description}

`;

        if (issue.recommendation) {
          content += `> **💡 Recommendation**  
> ${issue.recommendation}

`;
        }

        if (options?.includeMetadata && issue.metadata) {
          content += `<details>
<summary>Technical Metadata</summary>

\`\`\`json
${JSON.stringify(issue.metadata, null, 2)}
\`\`\`
</details>

`;
        }

        content += '---\n\n';
      }
    }

    return content;
  }

  /**
   * Generate recommendations section
   */
  private generateRecommendations(report: MonitoringReport, options?: ReportOptions): string {
    if (!report.recommendations?.length) return '';

    let content = `## Recommendations

Based on the monitoring analysis, the following recommendations are suggested:

`;

    report.recommendations.forEach((recommendation, index) => {
      content += `${index + 1}. ${recommendation}\n\n`;
    });

    return content;
  }

  /**
   * Generate appendix with technical details
   */
  private generateAppendix(report: MonitoringReport, options?: ReportOptions): string {
    return `## Technical Details

### Execution Environment

| Property | Value |
|----------|-------|
| **Diamond Contract** | \`${report.diamond.address}\` |
| **Network** | ${report.network.name} (${report.network.chainId}) |
| **RPC URL** | \`${report.network.rpcUrl || 'N/A'}\` |
| **Block Explorer** | ${report.network.blockExplorerUrl || 'N/A'} |
| **Deployment Block** | ${report.diamond.deploymentBlock || 'N/A'} |
| **Config Path** | \`${report.diamond.configPath || 'N/A'}\` |

### Execution Statistics

| Metric | Value |
|--------|-------|
| **Total Execution Time** | ${(report.duration / 1000).toFixed(2)}s |
| **Modules Executed** | ${report.modules.length} |
| **Average Module Time** | ${(report.modules.reduce((sum, m) => sum + m.duration, 0) / report.modules.length / 1000).toFixed(2)}s |
| **Fastest Module** | ${this.getFastestModule(report)} |
| **Slowest Module** | ${this.getSlowestModule(report)} |

### Module Configuration

<details>
<summary>Show configuration details</summary>

\`\`\`json
${JSON.stringify(report.config, null, 2)}
\`\`\`
</details>

---

*Report generated by Diamond Monitoring System v1.0.0 on ${new Date().toISOString()}*`;
  }

  // Utility methods

  /**
   * Generate module performance table
   */
  private generateModulePerformanceTable(report: MonitoringReport): string {
    const rows = report.modules.map(m => {
      const statusIcon = this.getStatusIcon(m.status);
      const duration = (m.duration / 1000).toFixed(2);
      const issues = m.result.issues.length;

      return `| ${statusIcon} ${m.moduleName} | ${m.status} | ${duration}s | ${issues} |`;
    });

    return `| Module | Status | Duration | Issues |
|--------|--------|----------|--------|
${rows.join('\n')}`;
  }

  /**
   * Generate ASCII progress bar
   */
  private generateProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    return `\`\`\`
Progress: [${bar}] ${percentage.toFixed(1)}%
\`\`\``;
  }

  /**
   * Get status badge
   */
  private getStatusBadge(status: MonitoringStatus): string {
    switch (status) {
      case MonitoringStatus.PASS:
        return '![PASS](https://img.shields.io/badge/Status-PASS-brightgreen)';
      case MonitoringStatus.WARNING:
        return '![WARNING](https://img.shields.io/badge/Status-WARNING-yellow)';
      case MonitoringStatus.FAIL:
        return '![FAIL](https://img.shields.io/badge/Status-FAIL-red)';
      case MonitoringStatus.SKIPPED:
        return '![SKIPPED](https://img.shields.io/badge/Status-SKIPPED-lightgrey)';
      default:
        return '![UNKNOWN](https://img.shields.io/badge/Status-UNKNOWN-lightgrey)';
    }
  }

  /**
   * Get severity badge
   */
  private getSeverityBadge(severity: SeverityLevel): string {
    switch (severity) {
      case SeverityLevel.CRITICAL:
        return '![CRITICAL](https://img.shields.io/badge/Severity-CRITICAL-red)';
      case SeverityLevel.ERROR:
        return '![ERROR](https://img.shields.io/badge/Severity-ERROR-orange)';
      case SeverityLevel.WARNING:
        return '![WARNING](https://img.shields.io/badge/Severity-WARNING-yellow)';
      case SeverityLevel.INFO:
        return '![INFO](https://img.shields.io/badge/Severity-INFO-blue)';
      default:
        return '![UNKNOWN](https://img.shields.io/badge/Severity-UNKNOWN-lightgrey)';
    }
  }

  /**
   * Get status icon
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
   * Get severity icon
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
    }

    return sorted;
  }

  /**
   * Get fastest module
   */
  private getFastestModule(report: MonitoringReport): string {
    const fastest = report.modules.reduce((min, m) => (m.duration < min.duration ? m : min));
    return `${fastest.moduleName} (${(fastest.duration / 1000).toFixed(2)}s)`;
  }

  /**
   * Get slowest module
   */
  private getSlowestModule(report: MonitoringReport): string {
    const slowest = report.modules.reduce((max, m) => (m.duration > max.duration ? m : max));
    return `${slowest.moduleName} (${(slowest.duration / 1000).toFixed(2)}s)`;
  }
}
