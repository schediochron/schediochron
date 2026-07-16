import { render } from '@testing-library/react';
import { Layout } from './Layout';

describe('Layout', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Layout>content</Layout>);
    expect(baseElement).toBeTruthy();
  });

  it('should render children inside main', () => {
    const { getByRole } = render(<Layout>main content</Layout>);
    const main = getByRole('main');
    expect(main.textContent).toBe('main content');
  });

  it('should render the nav slot', () => {
    const { getByText } = render(
      <Layout nav={<nav>My Nav</nav>}>content</Layout>,
    );
    expect(getByText('My Nav')).toBeTruthy();
  });

  it('should render the footer slot', () => {
    const { getByText } = render(<Layout footer="© 2024">content</Layout>);
    expect(getByText('© 2024')).toBeTruthy();
  });

  it('should render the sidebar slot', () => {
    const { getByText } = render(
      <Layout sidebar={<div>Sidebar</div>}>content</Layout>,
    );
    expect(getByText('Sidebar')).toBeTruthy();
  });

  it('should render the top slot when provided', () => {
    const { getByText } = render(
      <Layout top={<div>Top Bar</div>}>content</Layout>,
    );
    expect(getByText('Top Bar')).toBeTruthy();
  });

  it('should not render a topbar element when top is not provided', () => {
    const { container } = render(<Layout>content</Layout>);
    expect(container.querySelector('.topbar')).toBeNull();
  });
});
