/**
 * JSON Report Formatter
 * 
 * Generates structured JSON reports suitable for CI/CD integration,
 * machine processing, and API consumption.
 */

import { MonitoringReport } from '../../core/types';
import { ReportFormatter, ReportOptions, ReportValidationResult } from '../types';

/**
 * JSON formatter for machine-readable reports
 */
export class JSONFormatter implements ReportFormatter {
  public readonly id = 'json';
  public readonly name = 'JSON Report';
  public readonly extension = '.json';
  public readonly mimeType = 'application/json';

  /**
   * Format the monitoring report as JSON
   */
  public async format(report: MonitoringReport, options?: ReportOptions): Promise<string> {
    const jsonReport = this.createJSONReport(report, options);
    
    // Pretty print or compact based on options
    const indentation = options?.compact ? 0 : 2;
    
    return JSON.stringify(jsonReport, this.createReplacer(options), indentation);
  }

  /**
   * Validate options for JSON formatting
   */
  public validateOptions(options?: ReportOptions): ReportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // JSON formatter accepts most options, but warn about irrelevant ones
    if (options?.colorOutput) {
      warnings.push('colorOutput option is ignored for JSON format');
    }

    if (options?.interactive) {
      warnings.push('interactive option is ignored for JSON format');
    }

    if (options?.theme) {
      warnings.push('theme option is ignored for JSON format');
    }

    return {
      isValid: true,
      errors,
      warnings
    };
  }

  // Private helper methods

  /**
   * Create the complete JSON report structure
   */
  private createJSONReport(report: MonitoringReport, options?: ReportOptions): any {
    const jsonReport: any = {
      // Metadata
      reportMetadata: {
        generatedAt: new Date().toISOString(),
        formatVersion: '1.0.0',
        generatorVersion: '1.0.0',
        options: this.sanitizeOptions(options)
      },

      // Core report data
      summary: {
        status: report.summary.status,
        totalChecks: report.summary.totalChecks,
        passed: report.summary.passed,
        failed: report.summary.failed,
        warnings: report.summary.warnings,
        skipped: report.summary.skipped,
        successRate: report.summary.totalChecks > 0 
          ? (report.summary.passed / report.summary.totalChecks * 100).toFixed(2) + '%'
          : '0%'
      },

      // Diamond information
      diamond: {
        name: report.diamond.name,
        address: report.diamond.address,
        configPath: report.diamond.configPath,
        deploymentBlock: report.diamond.deploymentBlock
      },

      // Network information
      network: {
        name: report.network.name,
        chainId: report.network.chainId,
        rpcUrl: report.network.rpcUrl,
        blockExplorerUrl: report.network.blockExplorerUrl
      },

      // Execution metadata
      execution: {
        timestamp: report.timestamp.toISOString(),
        duration: report.duration,
        durationHuman: this.formatDuration(report.duration)
      },

      // Module results
      modules: this.formatModules(report.modules, options),

      // Configuration
      config: options?.includeMetadata ? this.sanitizeConfig(report.config) : undefined
    };

    // Add recommendations if present and requested
    if (options?.includeRecommendations && report.recommendations?.length) {
      jsonReport.recommendations = report.recommendations;
    }

    // Add aggregated statistics
    if (options?.includeMetadata) {
      jsonReport.statistics = this.generateStatistics(report);
    }

    // Add issue analysis
    jsonReport.issueAnalysis = this.analyzeIssues(report, options);

    return jsonReport;
  }

  /**
   * Format module results for JSON
   */
  private formatModules(modules: any[], options?: ReportOptions): any[] {
    return modules.map(moduleResult => {
      const formattedModule: any = {
        moduleId: moduleResult.moduleId,
        moduleName: moduleResult.moduleName,
        status: moduleResult.status,
        execution: {
          startTime: moduleResult.startTime.toISOString(),
          endTime: moduleResult.endTime.toISOString(),
          duration: moduleResult.duration,
          durationHuman: this.formatDuration(moduleResult.duration)
        },
        result: {
          status: moduleResult.result.status,
          executionTime: moduleResult.result.executionTime,
          issueCount: moduleResult.result.issues.length,
          issues: this.formatIssues(moduleResult.result.issues, options)
        }
      };

      // Add metadata if present and requested
      if (options?.includeMetadata && moduleResult.result.metadata) {
        formattedModule.result.metadata = moduleResult.result.metadata;
      }

      // Add error information if present
      if (moduleResult.error) {
        formattedModule.error = {
          message: moduleResult.error.message,
          name: moduleResult.error.name,
          stack: options?.includeMetadata ? moduleResult.error.stack : undefined
        };
      }

      return formattedModule;
    });
  }

  /**
   * Format issues for JSON
   */
  private formatIssues(issues: any[], options?: ReportOptions): any[] {
    let processedIssues = [...issues];

    // Apply sorting if specified
    if (options?.sortBy) {
      processedIssues = this.sortIssues(processedIssues, options.sortBy);
    }

    // Apply filtering if specified
    if (options?.severityFilter?.length) {
      processedIssues = processedIssues.filter(issue => 
        options.severityFilter!.includes(issue.severity)
      );
    }

    // Apply limit if specified
    const maxIssues = options?.maxIssuesPerModule;
    if (maxIssues && maxIssues > 0) {
      processedIssues = processedIssues.slice(0, maxIssues);
    }

    return processedIssues.map(issue => ({
      id: issue.id,
      title: issue.title,
      description: issue.description,
      severity: issue.severity,
      category: issue.category,
      recommendation: issue.recommendation,
      metadata: options?.includeMetadata ? issue.metadata : undefined
    }));
  }

  /**
   * Generate aggregated statistics
   */
  private generateStatistics(report: MonitoringReport): any {
    const allIssues = report.modules.flatMap(m => m.result.issues);
    
    // Issue count by severity
    const severityCounts = {
      critical: allIssues.filter(i => i.severity === 'critical').length,
      error: allIssues.filter(i => i.severity === 'error').length,
      warning: allIssues.filter(i => i.severity === 'warning').length,
      info: allIssues.filter(i => i.severity === 'info').length
    };

    // Issue count by category
    const categoryMap = new Map<string, number>();
    allIssues.forEach(issue => {
      categoryMap.set(issue.category, (categoryMap.get(issue.category) || 0) + 1);
    });

    // Module performance
    const modulePerformance = report.modules.map(m => ({
      name: m.moduleName,
      duration: m.duration,
      issueCount: m.result.issues.length,
      status: m.status
    }));

    return {
      totalIssues: allIssues.length,
      severityDistribution: severityCounts,
      categoryDistribution: Object.fromEntries(categoryMap),
      modulePerformance,
      averageModuleDuration: report.modules.length > 0 
        ? Math.round(report.modules.reduce((sum, m) => sum + m.duration, 0) / report.modules.length)
        : 0
    };
  }

  /**
   * Analyze issues for insights
   */
  private analyzeIssues(report: MonitoringReport, options?: ReportOptions): any {
    const allIssues = report.modules.flatMap(m => m.result.issues);
    
    // Top issues by severity
    const criticalIssues = allIssues.filter(i => i.severity === 'critical');
    const errorIssues = allIssues.filter(i => i.severity === 'error');
    
    // Most problematic modules
    const moduleIssueMap = new Map<string, number>();
    report.modules.forEach(m => {
      moduleIssueMap.set(m.moduleName, m.result.issues.length);
    });
    
    const mostProblematicModules = Array.from(moduleIssueMap.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, issueCount: count }));

    // Common issue categories
    const categoryMap = new Map<string, number>();
    allIssues.forEach(issue => {
      categoryMap.set(issue.category, (categoryMap.get(issue.category) || 0) + 1);
    });
    
    const topCategories = Array.from(categoryMap.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    return {
      highPriorityIssues: {
        critical: criticalIssues.length,
        error: errorIssues.length,
        criticalTitles: criticalIssues.slice(0, 5).map(i => i.title),
        errorTitles: errorIssues.slice(0, 5).map(i => i.title)
      },
      mostProblematicModules,
      topIssueCategories: topCategories,
      hasBlockingIssues: criticalIssues.length > 0 || errorIssues.length > 0,
      recommendsAction: criticalIssues.length > 0
    };
  }

  /**
   * Sort issues by specified criteria
   */
  private sortIssues(issues: any[], sortBy: string): any[] {
    const sorted = [...issues];
    
    switch (sortBy) {
      case 'severity':
        const severityOrder: Record<string, number> = { 
          'critical': 0, 
          'error': 1, 
          'warning': 2, 
          'info': 3 
        };
        sorted.sort((a, b) => (severityOrder[a.severity] || 999) - (severityOrder[b.severity] || 999));
        break;
      case 'category':
        sorted.sort((a, b) => a.category.localeCompare(b.category));
        break;
      case 'timestamp':
        // If issues have timestamps, sort by them
        sorted.sort((a, b) => {
          const timestampA = a.metadata?.timestamp || 0;
          const timestampB = b.metadata?.timestamp || 0;
          return timestampB - timestampA; // Most recent first
        });
        break;
    }
    
    return sorted;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Sanitize options for JSON output
   */
  private sanitizeOptions(options?: ReportOptions): any {
    if (!options) return {};
    
    return {
      includeDetails: options.includeDetails,
      sortBy: options.sortBy,
      severityFilter: options.severityFilter,
      moduleFilter: options.moduleFilter,
      includeMetadata: options.includeMetadata,
      includeRecommendations: options.includeRecommendations,
      maxIssuesPerModule: options.maxIssuesPerModule,
      compact: options.compact
    };
  }

  /**
   * Sanitize config for JSON output
   */
  private sanitizeConfig(config: any): any {
    // Remove sensitive information and functions from config
    const sanitized = JSON.parse(JSON.stringify(config, (key, value) => {
      // Remove functions
      if (typeof value === 'function') return '[Function]';
      
      // Remove potentially sensitive keys
      if (key.toLowerCase().includes('key') || 
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('password')) {
        return '[REDACTED]';
      }
      
      return value;
    }));

    return sanitized;
  }

  /**
   * Create JSON replacer function
   */
  private createReplacer(options?: ReportOptions): ((key: string, value: any) => any) | undefined {
    if (!options?.compact) return undefined;
    
    return (key: string, value: any) => {
      // Remove null/undefined values in compact mode
      if (value === null || value === undefined) return undefined;
      
      // Remove empty arrays and objects in compact mode
      if (Array.isArray(value) && value.length === 0) return undefined;
      if (typeof value === 'object' && Object.keys(value).length === 0) return undefined;
      
      return value;
    };
  }
}
