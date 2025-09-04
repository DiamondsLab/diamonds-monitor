/**
 * HTML Report Formatter
 * 
 * Generates interactive HTML reports with professional styling,
 * charts, filtering capabilities, and responsive design.
 */

import { MonitoringReport, MonitoringStatus, SeverityLevel } from '../../core/types';
import { ReportFormatter, ReportOptions, ReportValidationResult, THEMES, ChartData } from '../types';

/**
 * HTML formatter with interactive features
 */
export class HTMLFormatter implements ReportFormatter {
  public readonly id = 'html';
  public readonly name = 'HTML Report';
  public readonly extension = '.html';
  public readonly mimeType = 'text/html';

  /**
   * Format the monitoring report as interactive HTML
   */
  public async format(report: MonitoringReport, options?: ReportOptions): Promise<string> {
    const theme = THEMES[options?.theme || 'light'];
    const chartData = options?.includeCharts ? this.generateChartData(report) : undefined;
    
    return this.generateHTMLDocument(report, options, theme, chartData);
  }

  /**
   * Validate options for HTML formatting
   */
  public validateOptions(options?: ReportOptions): ReportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (options?.theme && !THEMES[options.theme] && options.theme !== 'auto') {
      errors.push(`Invalid theme: ${options.theme}. Available themes: ${Object.keys(THEMES).join(', ')}, auto`);
    }

    if (options?.colorOutput === false) {
      warnings.push('colorOutput=false is ignored for HTML format (always uses colors)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Private helper methods

  /**
   * Generate the complete HTML document
   */
  private generateHTMLDocument(
    report: MonitoringReport, 
    options?: ReportOptions, 
    theme?: any, 
    chartData?: ChartData[]
  ): string {
    const title = options?.title || `Diamond Monitoring Report - ${report.diamond.name}`;
    const description = options?.description || 
      `Monitoring report for ${report.diamond.name} on ${report.network.name}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description}">
  <title>${title}</title>
  ${this.generateCSS(theme, options)}
  ${options?.includeCharts ? this.generateChartJS() : ''}
</head>
<body>
  <div class="container">
    ${this.generateHeader(report, options)}
    ${this.generateSummary(report, options)}
    ${options?.includeCharts && chartData ? this.generateCharts(chartData) : ''}
    ${this.generateModuleResults(report, options)}
    ${this.generateDetailedIssues(report, options)}
    ${options?.includeRecommendations ? this.generateRecommendations(report, options) : ''}
    ${this.generateFooter(report, options)}
  </div>
  
  ${options?.interactive ? this.generateJavaScript(options) : ''}
</body>
</html>`;
  }

  /**
   * Generate CSS styles
   */
  private generateCSS(theme?: any, options?: ReportOptions): string {
    const customCSS = options?.customCss || '';
    
    return `<style>
      /* Reset and base styles */
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: ${theme?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'};
        font-size: ${theme?.fontSize || '14px'};
        line-height: 1.6;
        color: ${theme?.textColor || '#212121'};
        background: ${theme?.backgroundColor || '#f5f5f5'};
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background: ${theme?.backgroundColor || '#ffffff'};
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        border-radius: 8px;
      }

      /* Header styles */
      .header {
        text-align: center;
        margin-bottom: 40px;
        padding-bottom: 20px;
        border-bottom: 2px solid ${theme?.borderColor || '#e0e0e0'};
      }

      .title {
        color: ${theme?.primaryColor || '#1565c0'};
        font-size: 2.5em;
        font-weight: 700;
        margin-bottom: 10px;
      }

      .subtitle {
        color: ${theme?.textColor || '#666'};
        font-size: 1.2em;
        margin-bottom: 20px;
      }

      /* Status badge */
      .status {
        display: inline-block;
        padding: 10px 20px;
        border-radius: 25px;
        font-weight: bold;
        font-size: 1.1em;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .status.PASS { background: ${theme?.successColor || '#e8f5e8'}; color: #2e7d32; }
      .status.WARNING { background: ${theme?.warningColor || '#fff3e0'}20; color: #f57c00; }
      .status.FAIL { background: ${theme?.errorColor || '#ffebee'}; color: #c62828; }
      .status.SKIPPED { background: #f5f5f5; color: #666; }

      /* Section styles */
      .section {
        margin: 40px 0;
      }

      .section-title {
        color: ${theme?.primaryColor || '#1565c0'};
        font-size: 1.8em;
        font-weight: 600;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid ${theme?.borderColor || '#e0e0e0'};
        display: flex;
        align-items: center;
      }

      .section-title .icon {
        margin-right: 10px;
        font-size: 1.2em;
      }

      /* Statistics grid */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin: 30px 0;
      }

      .stat-card {
        background: ${theme?.backgroundColor || '#f8f9fa'};
        border: 1px solid ${theme?.borderColor || '#e0e0e0'};
        border-radius: 8px;
        padding: 25px;
        text-align: center;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      }

      .stat-value {
        font-size: 2.5em;
        font-weight: bold;
        color: ${theme?.primaryColor || '#1565c0'};
        margin-bottom: 5px;
      }

      .stat-label {
        color: ${theme?.textColor || '#666'};
        font-size: 0.9em;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      /* Module cards */
      .modules-grid {
        display: grid;
        gap: 20px;
      }

      .module-card {
        border: 1px solid ${theme?.borderColor || '#e0e0e0'};
        border-radius: 8px;
        overflow: hidden;
        background: ${theme?.backgroundColor || '#ffffff'};
        transition: box-shadow 0.2s;
      }

      .module-card:hover {
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      }

      .module-header {
        padding: 20px;
        background: ${theme?.backgroundColor || '#f8f9fa'};
        border-bottom: 1px solid ${theme?.borderColor || '#e0e0e0'};
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .module-name {
        font-weight: bold;
        font-size: 1.2em;
      }

      .module-duration {
        color: ${theme?.textColor || '#666'};
        font-size: 0.9em;
      }

      /* Issues */
      .issues-container {
        padding: 20px;
      }

      .issue {
        margin: 15px 0;
        padding: 15px;
        border-radius: 6px;
        border-left: 4px solid;
        transition: transform 0.2s;
      }

      .issue:hover {
        transform: translateX(5px);
      }

      .issue.CRITICAL { 
        border-left-color: ${theme?.criticalColor || '#d32f2f'}; 
        background: ${theme?.criticalColor || '#d32f2f'}10; 
      }
      .issue.ERROR { 
        border-left-color: ${theme?.errorColor || '#f57c00'}; 
        background: ${theme?.errorColor || '#f57c00'}10; 
      }
      .issue.WARNING { 
        border-left-color: ${theme?.warningColor || '#fbc02d'}; 
        background: ${theme?.warningColor || '#fbc02d'}10; 
      }
      .issue.INFO { 
        border-left-color: ${theme?.primaryColor || '#1976d2'}; 
        background: ${theme?.primaryColor || '#1976d2'}10; 
      }

      .issue-title {
        font-weight: bold;
        margin-bottom: 8px;
        font-size: 1.1em;
      }

      .issue-description {
        color: ${theme?.textColor || '#666'};
        margin-bottom: 12px;
        line-height: 1.5;
      }

      .issue-recommendation {
        color: ${theme?.primaryColor || '#1976d2'};
        font-style: italic;
        background: ${theme?.primaryColor || '#1976d2'}10;
        padding: 10px;
        border-radius: 4px;
        margin-top: 10px;
      }

      .issue-metadata {
        margin-top: 10px;
        font-size: 0.85em;
        color: ${theme?.textColor || '#888'};
        background: ${theme?.backgroundColor || '#f5f5f5'};
        padding: 8px;
        border-radius: 4px;
      }

      /* Filter controls */
      .filters {
        background: ${theme?.backgroundColor || '#f8f9fa'};
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 30px;
        display: flex;
        gap: 15px;
        flex-wrap: wrap;
        align-items: center;
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .filter-label {
        font-weight: 500;
        color: ${theme?.textColor || '#555'};
      }

      select, input {
        padding: 8px 12px;
        border: 1px solid ${theme?.borderColor || '#ddd'};
        border-radius: 4px;
        font-size: 0.9em;
      }

      /* Charts */
      .charts-section {
        margin: 40px 0;
      }

      .charts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 30px;
        margin-top: 20px;
      }

      .chart-container {
        background: ${theme?.backgroundColor || '#ffffff'};
        border: 1px solid ${theme?.borderColor || '#e0e0e0'};
        border-radius: 8px;
        padding: 20px;
      }

      .chart-title {
        font-size: 1.2em;
        font-weight: 600;
        margin-bottom: 15px;
        text-align: center;
        color: ${theme?.primaryColor || '#1565c0'};
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .container {
          margin: 10px;
          padding: 15px;
        }

        .title {
          font-size: 2em;
        }

        .stats-grid {
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
        }

        .filters {
          flex-direction: column;
          align-items: stretch;
        }

        .filter-group {
          justify-content: space-between;
        }
      }

      /* Animations */
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .fade-in {
        animation: fadeIn 0.5s ease-out forwards;
      }

      /* Utility classes */
      .hidden { display: none !important; }
      .text-center { text-align: center; }
      .mb-20 { margin-bottom: 20px; }
      .mt-20 { margin-top: 20px; }

      /* Custom CSS */
      ${customCSS}
    </style>`;
  }

  /**
   * Generate Chart.js library inclusion
   */
  private generateChartJS(): string {
    return `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`;
  }

  /**
   * Generate header section
   */
  private generateHeader(report: MonitoringReport, options?: ReportOptions): string {
    const title = options?.title || `Diamond Monitoring Report`;
    const statusClass = report.summary.status;
    const statusIcon = this.getStatusIcon(report.summary.status);
    
    return `
    <div class="header">
      <h1 class="title">${title}</h1>
      <p class="subtitle">
        ${report.diamond.name} on ${report.network.name}
        ${options?.includeMetadata ? `• ${report.timestamp.toLocaleDateString()}` : ''}
      </p>
      <div class="status ${statusClass}">
        ${statusIcon} ${report.summary.status}
      </div>
    </div>`;
  }

  /**
   * Generate summary section
   */
  private generateSummary(report: MonitoringReport, options?: ReportOptions): string {
    return `
    <div class="section">
      <h2 class="section-title">
        <span class="icon">📋</span>
        Summary
      </h2>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${report.summary.totalChecks}</div>
          <div class="stat-label">Total Checks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #2e7d32;">${report.summary.passed}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #d32f2f;">${report.summary.failed}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #f57c00;">${report.summary.warnings}</div>
          <div class="stat-label">Warnings</div>
        </div>
        ${report.summary.skipped > 0 ? `
        <div class="stat-card">
          <div class="stat-value" style="color: #666;">${report.summary.skipped}</div>
          <div class="stat-label">Skipped</div>
        </div>` : ''}
      </div>

      ${options?.includeMetadata ? `
      <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <h3 style="margin-bottom: 15px; color: #1565c0;">Execution Details</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          <div><strong>Diamond Address:</strong><br>${report.diamond.address}</div>
          <div><strong>Network:</strong><br>${report.network.name} (Chain ID: ${report.network.chainId})</div>
          <div><strong>Duration:</strong><br>${(report.duration / 1000).toFixed(2)} seconds</div>
          <div><strong>Modules:</strong><br>${report.modules.length} executed</div>
        </div>
      </div>` : ''}
    </div>`;
  }

  /**
   * Generate charts section
   */
  private generateCharts(chartData: ChartData[]): string {
    return `
    <div class="section charts-section">
      <h2 class="section-title">
        <span class="icon">📊</span>
        Analytics
      </h2>
      
      <div class="charts-grid">
        ${chartData.map((chart, index) => `
          <div class="chart-container">
            <div class="chart-title">${chart.title}</div>
            <canvas id="chart-${index}" width="400" height="300"></canvas>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  /**
   * Generate module results section
   */
  private generateModuleResults(report: MonitoringReport, options?: ReportOptions): string {
    const maxIssues = options?.maxIssuesPerModule || 10;
    
    return `
    <div class="section">
      <h2 class="section-title">
        <span class="icon">🧩</span>
        Module Results
      </h2>
      
      ${options?.interactive ? this.generateFilters() : ''}
      
      <div class="modules-grid">
        ${report.modules.map(moduleResult => {
          const statusIcon = this.getStatusIcon(moduleResult.status);
          const issues = moduleResult.result.issues.slice(0, maxIssues);
          const remainingCount = moduleResult.result.issues.length - maxIssues;
          
          return `
          <div class="module-card" data-module="${moduleResult.moduleId}" data-status="${moduleResult.status}">
            <div class="module-header">
              <div>
                <span class="status ${moduleResult.status}">${statusIcon}</span>
                <span class="module-name">${moduleResult.moduleName}</span>
              </div>
              <div class="module-duration">
                ${(moduleResult.duration / 1000).toFixed(2)}s
              </div>
            </div>
            
            ${issues.length > 0 ? `
            <div class="issues-container">
              ${issues.map(issue => `
                <div class="issue ${issue.severity}" data-severity="${issue.severity}" data-category="${issue.category}">
                  <div class="issue-title">
                    ${this.getSeverityIcon(issue.severity)} ${issue.title}
                  </div>
                  <div class="issue-description">${issue.description}</div>
                  ${issue.recommendation ? `
                    <div class="issue-recommendation">
                      💡 ${issue.recommendation}
                    </div>
                  ` : ''}
                  ${options?.includeMetadata && issue.metadata ? `
                    <div class="issue-metadata">
                      <strong>Metadata:</strong> ${JSON.stringify(issue.metadata, null, 2)}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
              
              ${remainingCount > 0 ? `
                <div style="text-align: center; margin-top: 15px; color: #666;">
                  ... and ${remainingCount} more issue${remainingCount === 1 ? '' : 's'}
                </div>
              ` : ''}
            </div>` : `
            <div class="issues-container">
              <div style="text-align: center; color: #2e7d32; padding: 20px;">
                ✅ No issues found
              </div>
            </div>`}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  /**
   * Generate filters for interactive mode
   */
  private generateFilters(): string {
    return `
    <div class="filters">
      <div class="filter-group">
        <label class="filter-label" for="severity-filter">Severity:</label>
        <select id="severity-filter" onchange="filterIssues()">
          <option value="">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="ERROR">Error</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label class="filter-label" for="module-filter">Module:</label>
        <select id="module-filter" onchange="filterIssues()">
          <option value="">All Modules</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label class="filter-label" for="search-filter">Search:</label>
        <input type="text" id="search-filter" placeholder="Search issues..." oninput="filterIssues()">
      </div>
      
      <div class="filter-group">
        <button onclick="resetFilters()" style="padding: 8px 16px; background: #1565c0; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Reset Filters
        </button>
      </div>
    </div>`;
  }

  /**
   * Generate detailed issues section
   */
  private generateDetailedIssues(report: MonitoringReport, options?: ReportOptions): string {
    const allIssues = report.modules.flatMap(m => 
      m.result.issues.map(issue => ({ ...issue, module: m.moduleName }))
    );
    const criticalIssues = allIssues.filter(i => i.severity === SeverityLevel.CRITICAL);
    const errorIssues = allIssues.filter(i => i.severity === SeverityLevel.ERROR);
    
    if (criticalIssues.length === 0 && errorIssues.length === 0) {
      return '';
    }

    const highPriorityIssues = [...criticalIssues, ...errorIssues];
    
    return `
    <div class="section">
      <h2 class="section-title">
        <span class="icon">🚨</span>
        High Priority Issues
      </h2>
      
      <div style="margin-top: 20px;">
        ${highPriorityIssues.map((issue, index) => `
          <div class="issue ${issue.severity}" style="margin-bottom: 20px;">
            <div class="issue-title">
              ${index + 1}. ${this.getSeverityIcon(issue.severity)} ${issue.title}
            </div>
            <div style="margin: 10px 0; font-size: 0.9em; color: #666;">
              <strong>Module:</strong> ${issue.module} • <strong>Category:</strong> ${issue.category}
            </div>
            <div class="issue-description">${issue.description}</div>
            ${issue.recommendation ? `
              <div class="issue-recommendation">
                💡 <strong>Recommendation:</strong> ${issue.recommendation}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  /**
   * Generate recommendations section
   */
  private generateRecommendations(report: MonitoringReport, options?: ReportOptions): string {
    if (!report.recommendations?.length) return '';

    return `
    <div class="section">
      <h2 class="section-title">
        <span class="icon">💡</span>
        Recommendations
      </h2>
      
      <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #1976d2;">
        <ol style="margin-left: 20px;">
          ${report.recommendations.map(rec => `<li style="margin-bottom: 10px;">${rec}</li>`).join('')}
        </ol>
      </div>
    </div>`;
  }

  /**
   * Generate footer section
   */
  private generateFooter(report: MonitoringReport, options?: ReportOptions): string {
    return `
    <div style="margin-top: 50px; padding-top: 30px; border-top: 2px solid #e0e0e0; text-align: center; color: #666;">
      <p>Generated by Diamond Monitoring System v1.0.0</p>
      <p>Report generated at ${new Date().toLocaleString()}</p>
      ${options?.includeMetadata ? `
        <p style="margin-top: 10px; font-size: 0.9em;">
          Execution time: ${(report.duration / 1000).toFixed(2)}s • 
          Modules: ${report.modules.length} • 
          Total issues: ${report.modules.reduce((sum, m) => sum + m.result.issues.length, 0)}
        </p>
      ` : ''}
    </div>`;
  }

  /**
   * Generate JavaScript for interactivity
   */
  private generateJavaScript(options?: ReportOptions): string {
    return `
    <script>
      // Initialize when DOM is loaded
      document.addEventListener('DOMContentLoaded', function() {
        initializeFilters();
        ${options?.includeCharts ? 'initializeCharts();' : ''}
        addAnimations();
      });

      function initializeFilters() {
        // Populate module filter
        const moduleFilter = document.getElementById('module-filter');
        const modules = [...new Set(Array.from(document.querySelectorAll('[data-module]')).map(el => el.dataset.module))];
        modules.forEach(module => {
          const option = document.createElement('option');
          option.value = module;
          option.textContent = module.replace(/([A-Z])/g, ' $1').trim();
          moduleFilter.appendChild(option);
        });
      }

      function filterIssues() {
        const severityFilter = document.getElementById('severity-filter').value;
        const moduleFilter = document.getElementById('module-filter').value;
        const searchFilter = document.getElementById('search-filter').value.toLowerCase();

        document.querySelectorAll('.module-card').forEach(card => {
          let showCard = true;

          // Module filter
          if (moduleFilter && card.dataset.module !== moduleFilter) {
            showCard = false;
          }

          // Show/hide card
          card.style.display = showCard ? 'block' : 'none';

          // Filter issues within visible cards
          if (showCard) {
            const issues = card.querySelectorAll('.issue');
            let visibleIssues = 0;

            issues.forEach(issue => {
              let showIssue = true;

              // Severity filter
              if (severityFilter && issue.dataset.severity !== severityFilter) {
                showIssue = false;
              }

              // Search filter
              if (searchFilter && !issue.textContent.toLowerCase().includes(searchFilter)) {
                showIssue = false;
              }

              issue.style.display = showIssue ? 'block' : 'none';
              if (showIssue) visibleIssues++;
            });

            // Update issues container message
            const issuesContainer = card.querySelector('.issues-container');
            if (visibleIssues === 0 && issues.length > 0) {
              if (!issuesContainer.querySelector('.no-results')) {
                const noResults = document.createElement('div');
                noResults.className = 'no-results';
                noResults.style.cssText = 'text-align: center; color: #666; padding: 20px;';
                noResults.textContent = 'No issues match the current filters';
                issuesContainer.appendChild(noResults);
              }
            } else {
              const noResults = issuesContainer.querySelector('.no-results');
              if (noResults) noResults.remove();
            }
          }
        });
      }

      function resetFilters() {
        document.getElementById('severity-filter').value = '';
        document.getElementById('module-filter').value = '';
        document.getElementById('search-filter').value = '';
        filterIssues();
      }

      function addAnimations() {
        // Add fade-in animation to cards
        const cards = document.querySelectorAll('.module-card, .stat-card');
        cards.forEach((card, index) => {
          card.style.animationDelay = (index * 0.1) + 's';
          card.classList.add('fade-in');
        });
      }

      ${options?.includeCharts ? this.generateChartInitialization() : ''}
    </script>`;
  }

  /**
   * Generate chart initialization JavaScript
   */
  private generateChartInitialization(): string {
    return `
      function initializeCharts() {
        // Chart configurations will be injected here based on chart data
        // This is a placeholder for the actual chart initialization
      }`;
  }

  /**
   * Generate chart data for visualizations
   */
  private generateChartData(report: MonitoringReport): ChartData[] {
    const charts: ChartData[] = [];
    const allIssues = report.modules.flatMap(m => m.result.issues);

    // Severity distribution chart
    const severityCounts = {
      critical: allIssues.filter(i => i.severity === 'critical').length,
      error: allIssues.filter(i => i.severity === 'error').length,
      warning: allIssues.filter(i => i.severity === 'warning').length,
      info: allIssues.filter(i => i.severity === 'info').length
    };

    charts.push({
      type: 'doughnut',
      title: 'Issues by Severity',
      labels: ['Critical', 'Error', 'Warning', 'Info'],
      data: [severityCounts.critical, severityCounts.error, severityCounts.warning, severityCounts.info],
      backgroundColor: ['#d32f2f', '#f57c00', '#fbc02d', '#1976d2']
    });

    // Module performance chart
    charts.push({
      type: 'bar',
      title: 'Module Execution Time',
      labels: report.modules.map(m => m.moduleName.replace(/([A-Z])/g, ' $1').trim()),
      data: report.modules.map(m => m.duration),
      backgroundColor: ['#42a5f5']
    });

    return charts;
  }

  // Utility methods

  private getStatusIcon(status: MonitoringStatus): string {
    switch (status) {
      case MonitoringStatus.PASS: return '✅';
      case MonitoringStatus.WARNING: return '⚠️';
      case MonitoringStatus.FAIL: return '❌';
      case MonitoringStatus.SKIPPED: return '⏭️';
      default: return 'ℹ️';
    }
  }

  private getSeverityIcon(severity: SeverityLevel): string {
    switch (severity) {
      case SeverityLevel.CRITICAL: return '🚨';
      case SeverityLevel.ERROR: return '❌';
      case SeverityLevel.WARNING: return '⚠️';
      case SeverityLevel.INFO: return 'ℹ️';
      default: return '•';
    }
  }
}
