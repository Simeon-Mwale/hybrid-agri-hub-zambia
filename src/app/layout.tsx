 import "./globals.css";

export const metadata = {
  title: "Hybrid Agricultural Hub Zambia",
  description: "Market price prediction system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

