// src/ui/renderer.js — UI Router and delegation layer

import { MenuScreen } from './screens/menu-screen.js';
import { CitySelectScreen } from './screens/cityselect-screen.js';
import { SettingsScreen } from './screens/settings-screen.js';
import { DispatchScreen } from './screens/dispatch-screen.js';
import { MessengerScreen } from './screens/messenger-screen.js';
import { CrisisScreen } from './screens/crisis-screen.js';
import { ReportScreen } from './screens/report-screen.js';

export class Renderer {
  constructor(container) {
    this.container = container;
    this.activeAdvisorId = null;
    this.activeCrisisId  = null;
  }

  setActiveAdvisor(id) { this.activeAdvisorId = id; }
  setActiveCrisis(id)  { this.activeCrisisId  = id; }

  render(screen, state) {
    this.container.innerHTML = '';
    const handlers = {
      goToMenu: () => window.GOVERNED?.goToMenu(),
      goToSettings: () => window.GOVERNED?.goToSettings(),
      goToCitySelect: () => window.GOVERNED?.goToCitySelect(),
      startGame: (cityKey, govName) => window.GOVERNED?.startGame(cityKey, govName),
      nextTurn: () => window.GOVERNED?.nextTurn(),
      handleDecision: (decisionId, optionIndex) => window.GOVERNED?.handleDecision(decisionId, optionIndex),
      openMessenger: (advisorId) => window.GOVERNED?.openMessenger(advisorId),
      backToDispatch: () => window.GOVERNED?.backToDispatch(),
      handleCrisisDecision: (crisisId, optionIndex, advisorSecretId) => window.GOVERNED?.handleCrisisDecision(crisisId, optionIndex, advisorSecretId),
      acceptScandal: () => window.GOVERNED?.acceptScandal(),
      suppressScandal: () => window.GOVERNED?.suppressScandal(),
      respondToScandal: (responseId) => window.GOVERNED?.respondToScandal(responseId),
      acceptBribe: (advisorId) => window.GOVERNED?.acceptBribe(advisorId),
      declineBribe: (advisorId) => window.GOVERNED?.declineBribe(advisorId),
      shiftAdvisorRelationship: (advisorId, delta) => window.GOVERNED?.shiftAdvisorRelationship(advisorId, delta),
      dismissBetrayal: () => window.GOVERNED?.dismissBetrayal(),
      dismissScandalReveal: () => window.GOVERNED?.dismissScandalReveal(),
      acceptContract:      (id) => window.GOVERNED?.acceptContract(id),
      declineContract:     (id) => window.GOVERNED?.declineContract(id),
      declineAllContracts: () =>  window.GOVERNED?.declineAllContracts(),
      resolveUnrest:       (action) => window.GOVERNED?.resolveUnrest(action),
      useEmergencyPower:   (id) =>     window.GOVERNED?.useEmergencyPower(id),
      backChannelAction:   (advisorId, actionId) => window.GOVERNED?.backChannelAction(advisorId, actionId),
      resignEarly:         () => window.GOVERNED?.resignEarly(),
    };

    switch (screen) {
      case 'menu':
        this.container.innerHTML = MenuScreen.render(state);
        MenuScreen.bind(this.container, handlers);
        break;
      case 'cityselect':
        this.container.innerHTML = CitySelectScreen.render(state);
        CitySelectScreen.bind(this.container, handlers);
        break;
      case 'settings':
        this.container.innerHTML = SettingsScreen.render(state);
        SettingsScreen.bind(state, this.container, handlers, () => this.render('settings', state));
        break;
      case 'dispatch':
        this.container.innerHTML = DispatchScreen.render(state);
        DispatchScreen.bind(state, this.container, handlers);
        break;
      case 'messenger':
        this.container.innerHTML = MessengerScreen.render(state, this.activeAdvisorId);
        MessengerScreen.bind(state, this.activeAdvisorId, this.container, handlers, () => this.render('messenger', state));
        break;
      case 'crisis':
        this.container.innerHTML = CrisisScreen.render(state, this.activeCrisisId);
        CrisisScreen.bind(this.activeCrisisId, this.container, handlers);
        break;
      case 'report':
        this.container.innerHTML = ReportScreen.render(state);
        ReportScreen.bind(this.container);
        break;
      default:
        this.container.innerHTML = MenuScreen.render(state);
        MenuScreen.bind(this.container, handlers);
    }
  }
}
