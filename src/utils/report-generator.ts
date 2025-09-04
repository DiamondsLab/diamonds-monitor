/**
 * Report Generation Utilities for Diamond Monitoring
 *
 * Handles the generation of monitoring reports in various formats
 * (console, JSON, HTML, etc.)
 */

import * as fs from 'fs/promises';
import chalk from 'chalk';

import { MonitoringReport, MonitoringStatus, SeverityLevel, MonitoringIssue } from '../core/types';

/**
 * Report output options
 */
export interface ReportOptions {
  format: 'console' | 'json' | 'html' | 'csv';
  outputFile?: string;
  includeDetails?: boolean;
  colorOutput?: boolean;
  sortBy?: 'severity' | 'module' | 'category';
}

/**
 * Generate and output monitoring report
 */
export async function generateReport(
  report: MonitoringReport,
  options: ReportOptions = { format: 'console' }
): Promise<void> {
  switch (options.format) {
    case 'console':
      await generateConsoleReport(report, options);
      break;
    case 'json':
      await generateJsonReport(report, options);
      break;
    case 'html':
      await generateHtmlReport(report, options);
      break;
    case 'csv':
      await generateCsvReport(report, options);
      break;
    default:
      throw new Error(`Unsupported report format: ${options.format}`);
  }
}

/**
 * Generate console report
 */
export async function generateConsoleReport(
  report: MonitoringReport,
  options: ReportOptions
): Promise<void> {
  const { colorOutput = true } = options;
  const c = colorOutput ? chalk : createNoColorChalk();

  console.log('\n' + c.blue('═'.repeat(80)));
  console.log(c.blue.bold('              DIAMOND VERIFICATION REPORT              '));
  console.log(c.blue('═'.repeat(80)));

  // Header information
  console.log('\n' + c.cyan('📋 SUMMARY'));
  console.log(c.cyan('─'.repeat(40)));
  console.log(`Diamond: ${c.white.bold(report.diamond.name)}`);
  console.log(`Address: ${c.white(report.diamond.address)}`);
  console.log(`Network: ${c.white(report.network.name)} (Chain ID: ${report.network.chainId})`);
  console.log(`Timestamp: ${c.white(report.timestamp.toISOString())}`);
  console.log(`Duration: ${c.white((report.duration / 1000).toFixed(2))}s`);

  // Status overview
  const statusColor = getStatusColor(report.summary.status, c);
  const statusIcon = getStatusIcon(report.summary.status);
  console.log(`\nStatus: ${statusColor(`${statusIcon} ${report.summary.status}`)}`);

  // Statistics
  console.log('\n' + c.cyan('📊 STATISTICS'));
  console.log(c.cyan('─'.repeat(40)));
  console.log(`Total Checks: ${c.white(report.summary.totalChecks)}`);
  console.log(`${c.green('✅ Passed:')} ${report.summary.passed}`);
  if (report.summary.failed > 0) {
    console.log(`${c.red('❌ Failed:')} ${report.summary.failed}`);
  }
  if (report.summary.warnings > 0) {
    console.log(`${c.yellow('⚠️  Warnings:')} ${report.summary.warnings}`);
  }
  if (report.summary.skipped > 0) {
    console.log(`${c.gray('⏭️  Skipped:')} ${report.summary.skipped}`);
  }

  // Module results
  if (options.includeDetails !== false) {
    console.log('\n' + c.cyan('🧩 MODULE RESULTS'));
    console.log(c.cyan('─'.repeat(40)));

    for (const moduleResult of report.modules) {
      const moduleStatusColor = getStatusColor(moduleResult.status, c);
      const moduleIcon = getStatusIcon(moduleResult.status);

      console.log(`\n${moduleStatusColor(`${moduleIcon} ${moduleResult.moduleName}`)}`);
      console.log(`   Duration: ${(moduleResult.duration / 1000).toFixed(2)}s`);
      console.log(`   Issues: ${moduleResult.result.issues.length}`);

      if (moduleResult.result.issues.length > 0) {
        const sortedIssues = sortIssues(moduleResult.result.issues, options.sortBy);
        for (const issue of sortedIssues.slice(0, 5)) {
          // Show first 5 issues
          const issueColor = getSeverityColor(issue.severity, c);
          const issueIcon = getSeverityIcon(issue.severity);
          console.log(`     ${issueColor(`${issueIcon} ${issue.title}`)}`);
          if (options.includeDetails) {
            console.log(`       ${c.gray(issue.description)}`);
          }
        }

        if (moduleResult.result.issues.length > 5) {
          console.log(
            `     ${c.gray(`... and ${moduleResult.result.issues.length - 5} more issues`)}`
          );
        }
      }
    }
  }

  // Detailed issues
  if (options.includeDetails) {
    const allIssues = report.modules.flatMap(m => m.result.issues);
    const criticalIssues = allIssues.filter(i => i.severity === SeverityLevel.CRITICAL);
    const errorIssues = allIssues.filter(i => i.severity === SeverityLevel.ERROR);

    if (criticalIssues.length > 0 || errorIssues.length > 0) {
      console.log('\n' + c.red('🚨 CRITICAL & ERROR ISSUES'));
      console.log(c.red('─'.repeat(40)));

      [...criticalIssues, ...errorIssues].forEach((issue, index) => {
        const issueColor = getSeverityColor(issue.severity, c);
        const issueIcon = getSeverityIcon(issue.severity);

        console.log(`\n${index + 1}. ${issueColor(`${issueIcon} ${issue.title}`)}`);
        console.log(`   Category: ${issue.category}`);
        console.log(`   Description: ${issue.description}`);
        if (issue.recommendation) {
          console.log(`   ${c.blue('💡 Recommendation:')} ${issue.recommendation}`);
        }
      });
    }
  }

  // Recommendations
  if (report.recommendations && report.recommendations.length > 0) {
    console.log('\n' + c.blue('💡 RECOMMENDATIONS'));
    console.log(c.blue('─'.repeat(40)));
    report.recommendations.forEach((recommendation, index) => {
      console.log(`${index + 1}. ${recommendation}`);
    });
  }

  console.log('\n' + c.blue('═'.repeat(80)));
}

/**
 * Generate JSON report
 */
export async function generateJsonReport(
  report: MonitoringReport,
  options: ReportOptions
): Promise<void> {
  const reportData = {
    ...report,
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
  };

  const jsonOutput = JSON.stringify(reportData, null, 2);

  if (options.outputFile) {
    await fs.writeFile(options.outputFile, jsonOutput, 'utf8');
    console.log(`JSON report saved to: ${options.outputFile}`);
  } else {
    console.log(jsonOutput);
  }
}

/**
 * Generate HTML report
 */
export async function generateHtmlReport(
  report: MonitoringReport,
  options: ReportOptions
): Promise<void> {
  const html = generateHtmlContent(report);

  if (options.outputFile) {
    await fs.writeFile(options.outputFile, html, 'utf8');
    console.log(`HTML report saved to: ${options.outputFile}`);
  } else {
    console.log(html);
  }
}

/**
 * Generate CSV report
 */
export async function generateCsvReport(
  report: MonitoringReport,
  options: ReportOptions
): Promise<void> {
  const csv = generateCsvContent(report);

  if (options.outputFile) {
    await fs.writeFile(options.outputFile, csv, 'utf8');
    console.log(`CSV report saved to: ${options.outputFile}`);
  } else {
    console.log(csv);
  }
}

/**
 * Generate HTML content
 */
function generateHtmlContent(report: MonitoringReport): string {
  const allIssues = report.modules.flatMap(m => m.result.issues);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diamond Monitoring Report - ${report.diamond.name}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 0; padding: 20px; background: #f5f5f5; 
    }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 30px; }
    .title { color: #1565c0; margin: 0; font-size: 28px; }
    .subtitle { color: #666; margin: 5px 0 0 0; }
    .status { padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; }
    .status.PASS { background: #e8f5e8; color: #2e7d32; }
    .status.WARNING { background: #fff3e0; color: #f57c00; }
    .status.FAIL { background: #ffebee; color: #c62828; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1565c0; }
    .stat-label { color: #666; font-size: 14px; }
    .section { margin: 30px 0; }
    .section-title { color: #1565c0; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px; margin-bottom: 20px; }
    .module { border: 1px solid #e0e0e0; border-radius: 8px; margin: 10px 0; overflow: hidden; }
    .module-header { padding: 15px; background: #f8f9fa; font-weight: bold; }
    .issue { padding: 15px; border-left: 4px solid #ddd; margin: 10px 0; }
    .issue.CRITICAL { border-left-color: #d32f2f; background: #ffebee; }
    .issue.ERROR { border-left-color: #f57c00; background: #fff3e0; }
    .issue.WARNING { border-left-color: #fbc02d; background: #fffde7; }
    .issue.INFO { border-left-color: #1976d2; background: #e3f2fd; }
    .issue-title { font-weight: bold; margin-bottom: 5px; }
    .issue-description { color: #666; margin-bottom: 10px; }
    .issue-recommendation { color: #1976d2; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">Diamond Monitoring Report</h1>
      <p class="subtitle">${report.diamond.name} on ${report.network.name}</p>
      <div style="margin-top: 15px;">
        <span class="status ${report.summary.status}">${report.summary.status}</span>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${report.summary.totalChecks}</div>
        <div class="stat-label">Total Checks</div>
      </div>
      <div class="stat">
        <div class="stat-value">${report.summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat">
        <div class="stat-value">${report.summary.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat">
        <div class="stat-value">${report.summary.warnings}</div>
        <div class="stat-label">Warnings</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Module Results</h2>
      ${report.modules
        .map(
          module => `
        <div class="module">
          <div class="module-header">
            <span class="status ${module.status}">${module.status}</span>
            ${module.moduleName} (${(module.duration / 1000).toFixed(2)}s)
          </div>
          ${module.result.issues
            .map(
              issue => `
            <div class="issue ${issue.severity}">
              <div class="issue-title">${issue.title}</div>
              <div class="issue-description">${issue.description}</div>
              ${issue.recommendation ? `<div class="issue-recommendation">💡 ${issue.recommendation}</div>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      `
        )
        .join('')}
    </div>

    <div class="section">
      <h2 class="section-title">Report Details</h2>
      <p><strong>Diamond Address:</strong> ${report.diamond.address}</p>
      <p><strong>Network:</strong> ${report.network.name} (Chain ID: ${report.network.chainId})</p>
      <p><strong>Monitoring Date:</strong> ${report.timestamp.toISOString()}</p>
      <p><strong>Duration:</strong> ${(report.duration / 1000).toFixed(2)} seconds</p>
      <p><strong>Total Issues:</strong> ${allIssues.length}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate CSV content
 */
function generateCsvContent(report: MonitoringReport): string {
  const rows = [
    [
      'Module',
      'Status',
      'Duration (ms)',
      'Issue ID',
      'Issue Title',
      'Severity',
      'Category',
      'Description',
      'Recommendation',
    ],
  ];

  for (const moduleResult of report.modules) {
    if (moduleResult.result.issues.length === 0) {
      rows.push([
        moduleResult.moduleName,
        moduleResult.status,
        moduleResult.duration.toString(),
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
    } else {
      for (const issue of moduleResult.result.issues) {
        rows.push([
          moduleResult.moduleName,
          moduleResult.status,
          moduleResult.duration.toString(),
          issue.id,
          issue.title,
          issue.severity,
          issue.category,
          issue.description.replace(/"/g, '""'), // Escape quotes
          issue.recommendation?.replace(/"/g, '""') || '',
        ]);
      }
    }
  }

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

/**
 * Sort issues by specified criteria
 */
function sortIssues(issues: MonitoringIssue[], sortBy?: string): MonitoringIssue[] {
  const sorted = [...issues];

  switch (sortBy) {
    case 'severity':
      const severityOrder: Record<SeverityLevel, number> = {
        [SeverityLevel.CRITICAL]: 0,
        [SeverityLevel.ERROR]: 1,
        [SeverityLevel.WARNING]: 2,
        [SeverityLevel.INFO]: 3,
      };
      sorted.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
      break;
    case 'category':
      sorted.sort((a, b) => a.category.localeCompare(b.category));
      break;
    default:
      // Keep original order
      break;
  }

  return sorted;
}

/**
 * Get color function for status
 */
function getStatusColor(status: MonitoringStatus, chalk: any): any {
  switch (status) {
    case MonitoringStatus.PASS:
      return chalk.green;
    case MonitoringStatus.WARNING:
      return chalk.yellow;
    case MonitoringStatus.FAIL:
      return chalk.red;
    default:
      return chalk.gray;
  }
}

/**
 * Get icon for status
 */
function getStatusIcon(status: MonitoringStatus): string {
  switch (status) {
    case MonitoringStatus.PASS:
      return '✅';
    case MonitoringStatus.WARNING:
      return '⚠️';
    case MonitoringStatus.FAIL:
      return '❌';
    default:
      return '⏭️';
  }
}

/**
 * Get color function for severity
 */
function getSeverityColor(severity: SeverityLevel, chalk: any): any {
  switch (severity) {
    case SeverityLevel.CRITICAL:
      return chalk.red.bold;
    case SeverityLevel.ERROR:
      return chalk.red;
    case SeverityLevel.WARNING:
      return chalk.yellow;
    case SeverityLevel.INFO:
      return chalk.blue;
    default:
      return chalk.gray;
  }
}

/**
 * Get icon for severity
 */
function getSeverityIcon(severity: SeverityLevel): string {
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
 * Create no-color chalk replacement
 */
function createNoColorChalk(): any {
  const identity = (text: string) => text;
  return new Proxy(
    {},
    {
      get: () =>
        new Proxy(identity, {
          get: () => identity,
          apply: (target, thisArg, args) => args[0],
        }),
    }
  );
}
