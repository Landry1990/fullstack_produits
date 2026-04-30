let router: any = null;

export const setRouter = (r: any) => {
  router = r;
};

export const navigate = (path: string, options?: any) => {
  if (router) {
    router.navigate(path, options);
  } else {
    console.warn('Navigation attempted before router was initialized');
    window.location.href = path;
  }
};
