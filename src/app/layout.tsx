import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Stock2",
  description: "한국어 시장·종목·포트폴리오 정보 탐색 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
