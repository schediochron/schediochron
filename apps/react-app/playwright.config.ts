import { defineConfig, devices } from '@playwright/test';

const previewURL = 'http://localhost:4300';
const devURL = 'http://localhost:4200';

// Point BASE_URL at a deployed application to test that instead of the two
// local servers.
const deployedURL = process.env['BASE_URL'];

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  // Unit tests are *.spec.*, e2e tests are *.e2e.* — the suffix is what keeps
  // bun test and playwright out of each other's files.
  testMatch: '**/*.e2e.ts',
  outputDir: './test-output/playwright/output',
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [['html', { outputFolder: './test-output/playwright/report' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  webServer: deployedURL
    ? undefined
    : [
        /* The built app — run `bun run build` before `bun run e2e`. */
        {
          command: 'bun run preview',
          url: previewURL,
          reuseExistingServer: !process.env['CI'],
        },
        {
          command: 'bun run dev',
          url: devURL,
          reuseExistingServer: !process.env['CI'],
        },
      ],
  // The suite runs against both servers because they bundle differently: a
  // module the dev server cannot resolve still builds cleanly for production,
  // so testing only the built output lets `bun run dev` break unnoticed.
  projects: deployedURL
    ? [
        {
          name: 'deployed',
          use: { ...devices['Desktop Chrome'], baseURL: deployedURL },
        },
      ]
    : [
        {
          name: 'preview',
          use: { ...devices['Desktop Chrome'], baseURL: previewURL },
        },
        {
          name: 'dev',
          use: { ...devices['Desktop Chrome'], baseURL: devURL },
        },
      ],
});
