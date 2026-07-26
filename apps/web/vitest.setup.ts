import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

const iframeSetAttribute = HTMLIFrameElement.prototype.setAttribute;

HTMLIFrameElement.prototype.setAttribute = function setIframeAttribute(name, value) {
  if (name.toLowerCase() === 'src' && value !== 'about:blank') {
    iframeSetAttribute.call(this, 'data-test-src', value);
    iframeSetAttribute.call(this, name, 'about:blank');
    return;
  }

  iframeSetAttribute.call(this, name, value);
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
