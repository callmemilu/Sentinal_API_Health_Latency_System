import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sentinel | Synthetic Health & Latency Monitoring',
  description: 'Proactive API uptime and latency tracking with automated alerts',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}