// src/main.js — App entry point
import { state } from './engine/game-state.js';
import { TurnManager } from './engine/turn-manager.js';
import { Renderer } from './ui/renderer.js';
import { loadCity } from './utils/validators.js';

// City registry
const CITY_REGISTRY = {
  jakarta:      () => import('./data/cities/jakarta.json'),
  gaza:         () => import('./data/cities/gaza.json'),
  caracas:      () => import('./data/cities/caracas.json'),
  tehran:       () => import('./data/cities/tehran.json'),
  tel_aviv:     () => import('./data/cities/tel-aviv.json'),
  crimea:       () => import('./data/cities/crimea.json'),
  lagos:        () => import('./data/cities/lagos.json'),
  frankfurt:    () => import('./data/cities/frankfurt.json'),
  jeddah:       () => import('./data/cities/jeddah.json'),
  beijing:      () => import('./data/cities/beijing.json'),
  nyc:          () => import('./data/cities/nyc.json'),
  toronto:      () => import('./data/cities/toronto.json'),
  sf:           () => import('./data/cities/sf.json'),
  singapore:    () => import('./data/cities/singapore.json'),
  shenzhen:     () => import('./data/cities/shenzhen.json'),
  karachi:      () => import('./data/cities/karachi.json'),
  cayman:       () => import('./data/cities/cayman.json'),
  mogadishu:    () => import('./data/cities/mogadishu.json'),
  johannesburg: () => import('./data/cities/johannesburg.json'),
  brisbane:     () => import('./data/cities/brisbane.json'),
};

class App {
  constructor() {
    this.state = state;
    this.turnManager = new TurnManager(this.state);
    this.renderer = new Renderer(document.getElementById('app'));
    this.currentScreen = 'menu';
    this.governorName = 'Governor';
  }

  init() {
    this.currentScreen = 'menu';
    this.render();
  }

  render() {
    this.renderer.render(this.currentScreen, this.state);
  }

  goToMenu() {
    this.currentScreen = 'menu';
    this.render();
  }

  goToCitySelect() {
    this.currentScreen = 'cityselect';
    this.render();
  }

  goToSettings() {
    this.currentScreen = 'settings';
    this.render();
  }

  async startGame(cityKey, governorName) {
    this.governorName = governorName || 'Governor';
    this.state.governorName = this.governorName;
    try {
      const loader = CITY_REGISTRY[cityKey];
      if (!loader) throw new Error('Unknown city: ' + cityKey);
      const module = await loader();
      const cityData = module.default ?? module;
      const city = loadCity(cityData);
      this.state.loadCity(city);
      this.currentScreen = 'dispatch';
      this.render();
      console.log('GOVERNED started:', city.city_name, '| Governor:', this.governorName);
    } catch (err) {
      console.error('Start failed:', err);
      this.currentScreen = 'menu';
      this.render();
    }
  }

  handleDecision(decisionId, optionIndex) {
    this.turnManager.resolveDecision(decisionId, optionIndex);
    this.render();
  }

  handleCrisisDecision(crisisId, optionIndex, advisorSecretId = null) {
    this.turnManager.resolveCrisis(crisisId, optionIndex, advisorSecretId);
    this.currentScreen = 'dispatch';
    this.render();
  }

  nextTurn() {
    const result = this.turnManager.processTurn();
    if (result === 'term_complete' || result === 'recalled') {
      this.currentScreen = 'report';
    } else if (this.state.activeCrises.length > 0) {
      this.currentScreen = 'crisis';
      this.renderer.setActiveCrisis(this.state.activeCrises[0]);
    }
    this.render();
  }

  openMessenger(advisorId) {
    this.currentScreen = 'messenger';
    this.renderer.setActiveAdvisor(advisorId);
    this.render();
  }

  openCrisis(crisisId) {
    this.currentScreen = 'crisis';
    this.renderer.setActiveCrisis(crisisId);
    this.render();
  }

  backToDispatch() {
    this.currentScreen = 'dispatch';
    this.render();
  }

  acceptScandal() {
    this.turnManager.acceptScandal();
    this.render();
  }

  suppressScandal() {
    this.turnManager.suppressScandal();
    this.render();
  }

  acceptBribe(advisorId) {
    this.turnManager.acceptBribe(advisorId);
    this.render();
  }

  declineBribe(advisorId) {
    this.turnManager.declineBribe(advisorId);
    this.render();
  }

  acceptContract(contractId) {
    this.turnManager.acceptContract(contractId);
    this.render();
  }

  declineContract(contractId) {
    this.turnManager.declineContract(contractId);
    this.render();
  }

  declineAllContracts() {
    this.turnManager.declineAllContracts();
    this.render();
  }

  resolveUnrest(action) {
    this.turnManager.resolveUnrest(action);
    this.render();
  }

  useEmergencyPower(advisorId) {
    this.turnManager.useEmergencyPower(advisorId);
    this.render();
  }

  respondToScandal(responseId) {
    const result = this.turnManager.respondToScandal(responseId);
    if (result.gameOver) {
      this.renderer.showScreen('report', this.state, { gameOver: true, reason: 'career_ending_scandal' });
    } else {
      this.render();
    }
  }

  shiftAdvisorRelationship(advisorId, delta) {
    this.turnManager.shiftAdvisorRelationship(advisorId, delta);
    this.render();
  }

  dismissBetrayal() {
    if (this.state.pendingBetrayals?.length > 0) {
      this.state.pendingBetrayals.shift();
    }
    this.render();
  }

  async switchCity(cityId) {
    this.state.city = null;
    await this.startGame(cityId, this.governorName);
  }
}

const app = new App();
app.init();

window.GOVERNED = app;
