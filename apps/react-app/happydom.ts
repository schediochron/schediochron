import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Preloaded before test-setup.ts: @testing-library/dom binds `screen` to
// document.body at module-init and permanently stubs it out if no document
// exists yet, so the DOM must be registered before Testing Library is imported.
// See https://github.com/testing-library/react-testing-library/issues/1348
GlobalRegistrator.register();
