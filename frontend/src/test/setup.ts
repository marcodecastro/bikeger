import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { createElement, Fragment } from 'react';
import { afterEach } from 'vitest';

Object.assign(globalThis, { React: { createElement, Fragment } });

afterEach(() => {
  cleanup();
});
