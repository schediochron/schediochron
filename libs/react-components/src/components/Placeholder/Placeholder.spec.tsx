import { describe, it, expect } from 'bun:test';
import { render } from '@testing-library/react';
import { Placeholder } from './Placeholder';

describe('Placeholder', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Placeholder />);
    expect(baseElement).toBeTruthy();
  });
});
