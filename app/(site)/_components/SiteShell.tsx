import React from 'react';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

type SiteShellProps = {
  title?: string;
  children: React.ReactNode;
};

export default function SiteShell({ title, children }: SiteShellProps) {
  return (
    <div className="site-shell">
      <SiteHeader title={title} />
      <main className="site-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
