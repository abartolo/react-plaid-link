import { PlaidLinkOptions, Plaid } from './types';

export interface PlaidFactory {
  open: Function;
  exit: Function;
  destroy: Function;
}

interface FactoryInternalState {
  plaid: Plaid | null;
  open: boolean;
  onExitCallback: Function | null;
}

const renameKeyInObject = (
  o: { [index: string]: any },
  oldKey: string,
  newKey: string
): object => {
  const newObject = {};
  delete Object.assign(newObject, o, { [newKey]: o[oldKey] })[oldKey];
  return newObject;
};

/**
 * Wrap link handler creation and instance to clean up iframe via destroy() method
 */
export const createPlaid = (options: PlaidLinkOptions) => {
  const state: FactoryInternalState = {
    plaid: null,
    open: false,
    onExitCallback: null,
  };

  // If Plaid is not available, throw an Error
  if (typeof window === 'undefined' || !window.Plaid) {
    throw new Error('Plaid not loaded');
  }

  const config = renameKeyInObject(
    options,
    'publicKey',
    'key'
  ) as PlaidLinkOptions;

  state.plaid = window.Plaid.create({
    ...config,
    onExit: (...params: any) => {
      // This fixes issue with Plaid not exiting properly and calling onSuccess multiple times due to multiple instances
      // Issue: https://github.com/plaid/react-plaid-link/pull/146/files
      state.open = false;
      config.onExit && config.onExit(...params);
      state.onExitCallback && state.onExitCallback();
    },
  });

  // Depending on settings configured, some use cases might support open method to take in some arugments
  // Ex. Passing institution_type to open institution directly
  const open = (...args: any[]) => {
    if (!state.plaid) {
      return;
    }
    state.open = true;
    state.onExitCallback = null;
    state.plaid.open(...args);
  };

  const exit = (exitOptions: any, callback: Function) => {
    if (!state.open || !state.plaid) {
      callback && callback();
      return;
    }
    state.onExitCallback = callback;
    state.plaid.exit(exitOptions);
    if (exitOptions && exitOptions.force) {
      state.open = false;
    }
  };

  const destroy = () => {
    if (!state.plaid) {
      return;
    }

    state.plaid.destroy();
    state.plaid = null;
  };

  return {
    open,
    exit,
    destroy,
  };
};
