import { initialize, mswLoader } from 'msw-storybook-addon';

// Start MSW in browser mode for Storybook — intercepts real fetch calls
// so stories never hit a real backend regardless of React Query hook options.
initialize({
  onUnhandledRequest: 'bypass', // let non-mocked requests pass (fonts, assets, etc.)
  serviceWorker: {
    url: '/mockServiceWorker.js',
  },
});

const preview = {
  loaders: [mswLoader],
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    msw: { handlers: [] }, // default: no handlers — each story declares its own
  },
};

export default preview;
