import { describe, expect, it } from 'vitest';

import { Button } from './Button.js';

describe('Button', () => {
  it('renders provided label', () => {
    const element = Button({ label: 'Primary button' });

    expect(element.type).toBe('button');
    expect(element.props.children).toBe('Primary button');
  });
});
