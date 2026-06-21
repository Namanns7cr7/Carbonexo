/**
 * Carbonexo store — pure reducer.
 *
 * Receives the current state and a typed action, returns the next state.
 * Has no side effects and no imports from React or the DOM.
 */
import type { PersistedState, StoreAction, PlanItem } from './types';

export function reducer(state: PersistedState, action: StoreAction): PersistedState {
  switch (action.type) {
    case 'hydrate':
      return action.state;

    case 'addLog':
      return { ...state, logs: [action.log, ...state.logs] };

    case 'removeLog':
      return { ...state, logs: state.logs.filter((l) => l.id !== action.id) };

    case 'addPlan': {
      const alreadyAdded = state.plan.some((p) => p.templateId === action.templateId);
      if (alreadyAdded) return state;
      const newItem: PlanItem = {
        templateId: action.templateId,
        addedAt: Date.now(),
        done: false,
      };
      return { ...state, plan: [...state.plan, newItem] };
    }

    case 'removePlan':
      return {
        ...state,
        plan: state.plan.filter((p) => p.templateId !== action.templateId),
      };

    case 'togglePlan':
      return {
        ...state,
        plan: state.plan.map((p) =>
          p.templateId === action.templateId ? { ...p, done: !p.done } : p,
        ),
      };

    case 'saveProfile':
      return { ...state, profile: { ...state.profile, ...action.patch } };

    case 'completeOnboarding':
      return { ...state, profile: { ...state.profile, onboarded: true } };

    case 'reset':
      // The seed is imported lazily to avoid a circular dep with the provider.
      // The provider handles 'reset' by dispatching then re-seeding externally.
      return state;

    default:
      return state;
  }
}
