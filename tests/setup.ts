import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

// @testing-library/preact only auto registers its own cleanup when a global `afterEach`
// exists. This project imports vitest's APIs explicitly rather than enabling globals, so
// the cleanup is registered here once for every test file instead.
afterEach(() => {
  cleanup();
});
