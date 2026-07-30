import type { NavigateFunction, NavigateOptions } from 'react-router-dom';

let router: { navigate: NavigateFunction } | null = null;

export const setRouter = (r: { navigate: NavigateFunction }) => {
  router = r;
};

export const navigate = (path: string, options?: NavigateOptions) => {
  if (router) {
    router.navigate(path, options);
  } else {
    console.warn('Navigation attempted before router was initialized');
    window.location.href = path;
  }
};
