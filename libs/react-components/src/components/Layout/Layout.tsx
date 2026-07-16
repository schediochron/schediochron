import './Layout.scss';

export interface LayoutProps {
  children: React.ReactNode;
  /** Top bar content (spans the full width). */
  top?: React.ReactNode;
  /** Navigation content (rendered in the nav area). */
  nav?: React.ReactNode;
  /** Sidebar content. */
  sidebar?: React.ReactNode;
  /** Details panel content. */
  details?: React.ReactNode;
  /** Footer content. */
  footer?: React.ReactNode;
}

export const Layout = ({
  children,
  top,
  nav,
  sidebar,
  details,
  footer,
}: LayoutProps) => {
  return (
    <div className="schediochron layout" role="application">
      {top && <div className="topbar">{top}</div>}
      {nav}
      <aside className="sidebar">{sidebar}</aside>
      <main>{children}</main>
      <aside className="details">{details}</aside>
      <footer>{footer}</footer>
    </div>
  );
};
