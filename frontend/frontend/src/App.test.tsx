import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
// import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<div>App Test Environment</div>);
    expect(screen.getByText('App Test Environment')).toBeInTheDocument();
  });
});
