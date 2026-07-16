import { afterEach } from 'bun:test';
import { cleanup } from '@testing-library/react';

// Testing Library only auto-cleans when afterEach is a global, which bun:test
// does not provide — without this, renders leak between test files.
afterEach(cleanup);
