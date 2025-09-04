/* eslint-disable */
// @ts-nocheck
/**
 * Example usage of the comprehensive report generation system
 */

import { ReportGenerator } from '../../src/reports/ReportGenerator';
import { ReportFormat } from '../../src/reports/types';

// Example monitoring report data (this would come from the actual monitoring system)
const exampleReport = {
  timestamp: new Date(),
  diamond: {
    name: 'ExampleDiamond',
    address: '0x1234567890123456789012345678901234567890',
  },
  network: {
    name: 'sepolia',
    chainId: 11155111,
  },
  summary: {
    status: 'warning' as const,
    totalChecks: 15,
    passed: 10,
    failed: 2,
    warnings: 3,
    skipped: 0,
  },
  modules: [
    {
      moduleId: 'security-check',
      moduleName: 'Security Validation',
      status: 'passed' as const,
      startTime: new Date(Date.now() - 5000),
      endTime: new Date(Date.now() - 3000),
      duration: 2000,
      result: {
        issues: [],
        metadata: { checksPerformed: 5 },
      },
    },
    {
      moduleId: 'gas-optimization',
      moduleName: 'Gas Optimization Check',
      status: 'warning' as const,
      startTime: new Date(Date.now() - 3000),
      endTime: new Date(Date.now() - 1000),
      duration: 2000,
      result: {
        issues: [
          {
            id: 'gas-001',
            title: 'High gas consumption detected',
            description: 'Function executeTransaction uses more gas than recommended',
            severity: 'warning' as const,
            category: 'performance',
            recommendation: 'Consider optimizing the function to reduce gas usage',
          },
        ],
        metadata: { averageGas: 125000 },
      },
    },
    {
      moduleId: 'access-control',
      moduleName: 'Access Control Verification',
      status: 'failed' as const,
      startTime: new Date(Date.now() - 1000),
      endTime: new Date(),
      duration: 1000,
      result: {
        issues: [
          {
            id: 'ac-001',
            title: 'Missing role validation',
            description: 'Critical function lacks proper role-based access control',
            severity: 'critical' as const,
            category: 'security',
            recommendation: 'Add role validation before function execution',
            metadata: { function: 'upgradeContract', requiredRole: 'UPGRADER_ROLE' },
          },
          {
            id: 'ac-002',
            title: 'Weak permission check',
            description: 'Permission validation could be bypassed in edge cases',
            severity: 'error' as const,
            category: 'security',
            recommendation: 'Strengthen permission validation logic',
          },
        ],
        metadata: { functionsChecked: 12 },
      },
    },
  ],
  duration: 5000,
};

/**
 * Demonstrate the comprehensive report generation system
 */
async function demonstrateReportGeneration() {
  console.log('🔧 Comprehensive Diamond Monitoring Report Generation Demo\n');

  try {
    // Generate console report (for terminal output)
    console.log('📺 Generating Console Report...');
    const consoleResult = await ReportGenerator.generateReport(
      exampleReport,
      ReportFormat.CONSOLE,
      undefined,
      {
        colorOutput: true,
        severityFilter: ['critical', 'error', 'warning'],
        includeMetadata: true,
      }
    );
    console.log('✅ Console report generated successfully');
    console.log('Output preview:', consoleResult.content.substring(0, 200) + '...\n');

    // Generate JSON report (for CI/CD and automation)
    console.log('📄 Generating JSON Report...');
    const jsonResult = await ReportGenerator.generateReport(
      exampleReport,
      ReportFormat.JSON,
      './reports/monitoring-report.json',
      {
        compact: false,
        includeMetadata: true,
      }
    );
    console.log('✅ JSON report generated and saved');
    console.log('Statistics:', JSON.stringify(jsonResult.statistics, null, 2), '\n');

    // Generate HTML report (for web viewing)
    console.log('🌐 Generating HTML Report...');
    const htmlResult = await ReportGenerator.generateReport(
      exampleReport,
      ReportFormat.HTML,
      './reports/monitoring-report.html',
      {
        interactive: true,
        includeCharts: true,
        theme: 'professional',
        includeMetadata: true,
      }
    );
    console.log('✅ HTML report generated and saved');
    console.log('File size:', htmlResult.fileSizeBytes, 'bytes\n');

    // Generate Markdown report (for documentation)
    console.log('📝 Generating Markdown Report...');
    const markdownResult = await ReportGenerator.generateReport(
      exampleReport,
      ReportFormat.MARKDOWN,
      './reports/monitoring-report.md',
      {
        includeMetadata: true,
        sortBy: 'severity',
      }
    );
    console.log('✅ Markdown report generated and saved');
    console.log('GitHub-compatible badges and tables included\n');

    // Generate CSV report (for data analysis)
    console.log('📊 Generating CSV Report...');
    const csvResult = await ReportGenerator.generateReport(
      exampleReport,
      ReportFormat.CSV,
      './reports/monitoring-report.csv',
      {
        compact: true,
        includeMetadata: true,
        sortBy: 'severity',
      }
    );
    console.log('✅ CSV report generated and saved');
    console.log('Ready for spreadsheet analysis\n');

    // Generate multiple formats at once
    console.log('🚀 Generating All Formats Simultaneously...');
    const multiResults = await ReportGenerator.generateMultipleReports(
      exampleReport,
      [ReportFormat.JSON, ReportFormat.HTML, ReportFormat.MARKDOWN, ReportFormat.CSV],
      './reports/complete-report',
      {
        includeMetadata: true,
        colorOutput: true,
        interactive: true,
        includeCharts: true,
      }
    );

    console.log('✅ All formats generated successfully!');
    console.log('Generated files:');
    multiResults.results.forEach((result, index) => {
      if (result.success && result.filePath) {
        console.log(`  📄 ${result.filePath} (${result.fileSizeBytes} bytes)`);
      }
    });

    console.log('\n🎉 Report generation demonstration completed!');
    console.log('Features demonstrated:');
    console.log('  ✅ Rich console output with colors and formatting');
    console.log('  ✅ Machine-readable JSON with statistics');
    console.log('  ✅ Interactive HTML with charts and filtering');
    console.log('  ✅ GitHub-compatible Markdown documentation');
    console.log('  ✅ CSV data for spreadsheet analysis');
    console.log('  ✅ Multi-format batch generation');
    console.log('  ✅ Professional styling and validation');
  } catch (error) {
    console.error('❌ Error during report generation:', error);
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateReportGeneration();
}
