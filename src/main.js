// src/main.js — App entry point
import { state } from './engine/game-state.js';
import { TurnManager } from './engine/turn-manager.js';
import { Renderer } from './ui/renderer.js';
import { loadCity } from './utils/validators.js';
import { loadSettings } from './utils/settings-store.js';
import { applyTheme } from './utils/theme.js';
import { recordGameStart, recordGameEnd } from './utils/career-stats.js';

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
  tokyo:        () => import('./data/cities/tokyo.json'),
  labuanbajo:   () => import('./data/cities/labuanbajo.json'),
  guatemala:    () => import('./data/cities/guatemala.json'),
  vladivostok:  () => import('./data/cities/vladivostok.json'),
  erbil:        () => import('./data/cities/erbil.json'),
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
    // Restore settings persisted independently of game saves
    const stored = loadSettings();
    if (stored) Object.assign(this.state.settings, stored);
    applyTheme(this.state.settings.theme);
    this.currentScreen = 'menu';
    this.render();
  }

  // Single exit point for every game-over path — records career stats once
  _endGame() {
    if (!this.state.hasFlag('career_recorded')) {
      recordGameEnd(this.state);
      this.state.setFlag('career_recorded', true);
    }
    this.currentScreen = 'report';
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
      recordGameStart();
      this.currentScreen = 'intro';
      this.render();
      console.log('GOVERNED started:', city.city_name, '| Governor:', this.governorName);
    } catch (err) {
      console.error('Start failed:', err);
      this.currentScreen = 'menu';
      this.render();
    }
  }

  // Leave the cold-open assessment and take office.
  beginTerm() {
    this.currentScreen = 'dispatch';
    this.render();
  }

  handleDecision(decisionId, optionIndex) {
    this.turnManager.resolveDecision(decisionId, optionIndex);
    this._checkInstantEnd();
    this.render();
  }

  handleCrisisDecision(crisisId, optionIndex, advisorSecretId = null) {
    this.turnManager.resolveCrisis(crisisId, optionIndex, advisorSecretId);
    this.currentScreen = 'dispatch';
    this._checkInstantEnd();
    this.render();
  }

  resignEarly() {
    if (!this.state.city || this.state.endReason) return;
    this.state.endReason = 'resigned';
    this._endGame();
    this.render();
  }

  dismissHeatNotice() {
    if (this.state.pendingHeatNotices?.length > 0) {
      this.state.pendingHeatNotices.shift();
    }
    this.render();
  }

  buyMarketOffer(offerId) {
    this.turnManager.buyMarketOffer(offerId);
    this._checkInstantEnd(); // a busted deal's scandal can zero approval
    this.render();
  }

  passMarket() {
    this.turnManager.passMarket();
    this.render();
  }

  addressNation(optionId) {
    this.turnManager.addressNation(optionId);
    this._checkInstantEnd();
    this.render();
  }

  loverDemand(accept) {
    const result = this.turnManager.resolveLoverDemand(accept);
    this._logToActiveAdvisor(result);
    this.render();
  }

  partnerDemand(accept) {
    const result = this.turnManager.resolvePartnerDemand(accept);
    this._logToActiveAdvisor(result);
    this.render();
  }

  // ── Day structure: meetings, consults, the morning paper ────────────────

  summonActor(actorName) {
    this.turnManager.summonActor(actorName);
    this.render();
  }

  skipMeeting() {
    this.turnManager.skipMeeting();
    this.render();
  }

  meetingResponse(accept) {
    this.turnManager.resolveMeeting(accept);
    this._checkInstantEnd(); // a busted meeting's scandal can zero approval
    this.render();
  }

  consultAdvisor(advisorId) {
    const result = this.turnManager.consultAdvisor(advisorId);
    const advisor = this.state.getAdvisor(advisorId);
    if (advisor && result?.msg) {
      if (!advisor._msgLog) advisor._msgLog = [];
      advisor._msgLog.push({ type: result.ok ? 'them' : 'sys', sender: result.ok ? advisor.name : undefined, text: result.msg });
    }
    this.render();
  }

  dismissNewspaper() {
    this.turnManager.dismissNewspaper();
    this.render();
  }

  _logToActiveAdvisor(result) {
    const advisorId = this.renderer.activeAdvisorId;
    const advisor = advisorId ? this.state.getAdvisor(advisorId) : null;
    if (advisor && result?.msg) {
      if (!advisor._msgLog) advisor._msgLog = [];
      advisor._msgLog.push({ type: 'sys', text: result.msg });
    }
  }

  // A consequence (e.g. a triggered scandal) can zero approval mid-turn
  _checkInstantEnd() {
    if (this.state.approval <= 0) {
      this.state.endReason = 'recalled';
      this._endGame();
    }
  }

  nextTurn() {
    this.state.viewingScandal = false;
    const result = this.turnManager.processTurn();
    if (result === 'term_complete' || result === 'recalled') {
      this._endGame();
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
    this.state.viewingScandal = false;
    this.turnManager.acceptScandal();
    // A scandal's approval penalty can drop the governor to 0 — end early
    if (this.state.approval <= 0) {
      this.state.endReason = 'recalled';
      this._endGame();
    }
    this.render();
  }

  suppressScandal() {
    this.state.viewingScandal = false;
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
    this.state.viewingScandal = false;
    const result = this.turnManager.respondToScandal(responseId);
    if (result.gameOver) {
      // BUGFIX: this used to call this.renderer.showScreen(), which doesn't
      // exist — the game crashed instead of ending the term early.
      this._endGame();
    }
    this.render();
  }

  viewScandal() {
    this.state.viewingScandal = true;
    this.render();
  }

  shiftAdvisorRelationship(advisorId, delta) {
    this.turnManager.shiftAdvisorRelationship(advisorId, delta);
    this.render();
  }

  backChannelAction(advisorId, actionId) {
    const result  = this.turnManager.backChannelAction(advisorId, actionId);
    const advisor = this.state.getAdvisor(advisorId);
    if (advisor && result?.msg) {
      if (!advisor._msgLog) advisor._msgLog = [];
      advisor._msgLog.push({ type: 'sys', text: result.msg });
    }
    // A back-channel scandal can end the term (career-ending leak/pact exposure)
    if (this.state.approval <= 0) {
      this.state.endReason = 'recalled';
      this._endGame();
    }
    this.render();
  }

  dismissBetrayal() {
    if (this.state.pendingBetrayals?.length > 0) {
      this.state.pendingBetrayals.shift();
    }
    this.render();
  }

  dismissScandalReveal() {
    if (this.state.pendingScandalReveals?.length > 0) {
      this.state.pendingScandalReveals.shift();
    }
    // A surprise scandal can zero out approval — end the term if so
    if (this.state.approval <= 0) {
      this.state.endReason = 'recalled';
      this._endGame();
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
