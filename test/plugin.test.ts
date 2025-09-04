import { expect } from 'chai';
import * as hre from 'hardhat';

// Import our plugin
import '../src/index';

describe('Hardhat Diamond Monitor Plugin', function () {
  it('should extend Hardhat Runtime Environment', function () {
    expect(hre).to.have.property('diamondMonitor');
    expect(hre.diamondMonitor).to.have.property('monitorDiamond');
    expect(hre.diamondMonitor).to.have.property('createMonitoringSystem');
    expect(hre.diamondMonitor).to.have.property('listModules');
  });

  it('should create monitoring system', function () {
    const system = hre.diamondMonitor.createMonitoringSystem();

    expect(system).to.have.property('registerModule');
    expect(system).to.have.property('getRegisteredModules');
    expect(system).to.have.property('runMonitoring');
  });

  it('should list available modules', function () {
    const modules = hre.diamondMonitor.listModules();

    expect(modules).to.be.an('array');
    expect(modules.length).to.be.greaterThan(0);

    // Check for default modules
    const moduleNames = modules.map(m => m.name);
    expect(moduleNames).to.include('Function Selector Monitoring');
    expect(moduleNames).to.include('Diamond Structure Monitoring');
  });

  it('should have proper module structure', function () {
    const modules = hre.diamondMonitor.listModules();
    const firstModule = modules[0];

    expect(firstModule).to.have.property('id');
    expect(firstModule).to.have.property('name');
    expect(firstModule).to.have.property('description');
    expect(firstModule).to.have.property('version');
    expect(firstModule).to.have.property('category');
  });
});
