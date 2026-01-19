// apps/desktop/src/main/store/providerSettings.ts

import Store from 'electron-store';
import type { ProviderSettings, ProviderId, ConnectedProvider } from '@accomplish/shared';

const DEFAULT_SETTINGS: ProviderSettings = {
  activeProviderId: null,
  connectedProviders: {},
  debugMode: false,
};

const providerSettingsStore = new Store<ProviderSettings>({
  name: 'provider-settings',
  defaults: DEFAULT_SETTINGS,
});

export function getProviderSettings(): ProviderSettings {
  return {
    activeProviderId: providerSettingsStore.get('activeProviderId'),
    connectedProviders: providerSettingsStore.get('connectedProviders'),
    debugMode: providerSettingsStore.get('debugMode'),
  };
}

export function setActiveProvider(providerId: ProviderId | null): void {
  providerSettingsStore.set('activeProviderId', providerId);
}

export function getActiveProviderId(): ProviderId | null {
  return providerSettingsStore.get('activeProviderId');
}

export function getConnectedProvider(providerId: ProviderId): ConnectedProvider | null {
  const providers = providerSettingsStore.get('connectedProviders');
  return providers[providerId] ?? null;
}

export function setConnectedProvider(providerId: ProviderId, provider: ConnectedProvider): void {
  const providers = providerSettingsStore.get('connectedProviders');
  providerSettingsStore.set('connectedProviders', {
    ...providers,
    [providerId]: provider,
  });
}

export function removeConnectedProvider(providerId: ProviderId): void {
  const providers = providerSettingsStore.get('connectedProviders');
  const { [providerId]: _, ...rest } = providers;
  providerSettingsStore.set('connectedProviders', rest);

  // If this was the active provider, clear it
  if (providerSettingsStore.get('activeProviderId') === providerId) {
    providerSettingsStore.set('activeProviderId', null);
  }
}

export function updateProviderModel(providerId: ProviderId, modelId: string | null): void {
  const provider = getConnectedProvider(providerId);
  if (provider) {
    setConnectedProvider(providerId, {
      ...provider,
      selectedModelId: modelId,
    });
  }
}

export function setProviderDebugMode(enabled: boolean): void {
  providerSettingsStore.set('debugMode', enabled);
}

export function getProviderDebugMode(): boolean {
  return providerSettingsStore.get('debugMode');
}

export function clearProviderSettings(): void {
  providerSettingsStore.clear();
}
