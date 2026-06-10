import { randomPick, shuffle } from '../utils/random.js';

export class CrisisManager {
  constructor(state) {
    this.state = state;
  }

  getAvailableCrises() {
    const s = this.state;
    if (!s.city) return [];
    return s.city.crises.filter(c =>
      !s.resolvedCrises.includes(c.id) &&
      !s.activeCrises.includes(c.id) &&
      s.turn >= (c.turn_min ?? 1) &&
      s.turn <= (c.turn_max ?? 12)
    );
  }

  shouldTriggerCrisis() {
    const CRISIS_TURNS = [4, 8, 12];
    if (!CRISIS_TURNS.includes(this.state.turn)) return false;
    if (this.state.turn === 12 && this.getAvailableCrises().length === 0) {
      return (this.state.city?.crises?.length ?? 0) > 0;
    }
    return this.getAvailableCrises().length > 0;
  }

  selectCrisisPool() {
    const available = this.state.city?.crises?.filter(c => !c.war_mode) ?? [];
    const shuffled = shuffle(available);
    return shuffled.slice(0, Math.min(3, shuffled.length)).map(c => c.id);
  }

  triggerCrisis() {
    const s = this.state;
    let available = this.getAvailableCrises();

    if (available.length === 0 && s.turn === 12) {
      const allCrises = s.city?.crises ?? [];
      available = allCrises.filter(c => !s.activeCrises.includes(c.id) && !c.war_mode);
    }

    if (available.length > 0) {
      const crisis = randomPick(available);
      s.resolvedCrises = s.resolvedCrises.filter(id => id !== crisis.id);
      s.activeCrises.push(crisis.id);
      return crisis.id;
    }
    return null;
  }
}
