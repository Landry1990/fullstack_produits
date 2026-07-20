let router: unknown = null;

export const setRouter = (r: unknown) => {
  router = r;
};

export const navigate = (path: string, options?: unknown) => {
  if (router) {
    router.navigate(path, options);
  } else {
    console.warn('Navigation attempted before router was initialized');
    window.location.href = path;
  }
};
