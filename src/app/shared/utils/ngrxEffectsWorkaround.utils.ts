import { Actions, EffectSources, EffectsRunner } from '@ngrx/effects';

const effectProvidersForWorkaround = [EffectsRunner, EffectSources, Actions];
let effectsWorkaroundInitialized = false;

export const getEffectsRootProviders = () => {
  if (!effectsWorkaroundInitialized) {
    effectProvidersForWorkaround.forEach((provider) => {
      provider.ɵprov.providedIn = null;
    });
    effectsWorkaroundInitialized = true;
  }

  return effectProvidersForWorkaround;
};
