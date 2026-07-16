import { afterEach } from 'bun:test';
import { plugin } from 'bun';
import { cleanup } from '@testing-library/react';

// The bundler turns `*.module.css` into a class map, but the test runtime hands
// back the file path instead — components would render with no classNames.
// Echoing the key back keeps class-based queries meaningful in tests.
plugin({
  name: 'css-modules',
  setup(build) {
    build.onLoad({ filter: /\.module\.css$/ }, () => ({
      exports: {
        default: new Proxy({}, { get: (_target, key) => String(key) }),
      },
      loader: 'object',
    }));
  },
});

// Testing Library only auto-cleans when afterEach is a global, which bun:test
// does not provide — without this, renders leak between test files.
afterEach(cleanup);
