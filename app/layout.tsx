import type {Metadata} from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'LightRoom Web Pro',
  description: 'Professional photo retouching application',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
