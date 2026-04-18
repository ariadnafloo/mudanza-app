import { Html, Head, Main, NextScript } from "next/document";

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="%23002FA7"/><text y="78" x="50" text-anchor="middle" font-size="72">\uD83D\uDCE6</text></svg>';
const faviconUrl = "data:image/svg+xml," + svg;

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <link rel="icon" href={faviconUrl} />
        <link rel="apple-touch-icon" href={faviconUrl} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#002FA7" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Mudanza" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}