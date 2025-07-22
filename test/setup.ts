import { expect, afterEach } from 'vitest';
import { cleanup } from '@solidjs/testing-library';
import matchers from '@testing-library/jest-dom/matchers';

// Add custom jest-dom matchers
expect.extend(matchers);

// Cleanup after each test case
afterEach(() => cleanup());