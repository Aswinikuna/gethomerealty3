// Root layout for the React routes (the admin). The public website is plain HTML
// in public/ and never loads any of this.
import type { Metadata, Viewport } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: { default: 'Admin · Get Home Realty', template: '%s · GHR Admin' },
  robots: { index: false, follow: false },
  icons: { icon: '/assets/img/ghr-icon-32.png', apple: '/assets/img/ghr-icon-180.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
