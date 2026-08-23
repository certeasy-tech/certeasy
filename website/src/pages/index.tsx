import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import { Redirect } from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

// The destination depends on which version is served at the root, so it is
// declared once in docusaurus.config.ts and read back here.
//
// `<Redirect>` renders nothing at all during SSR, so this page used to build to
// an index.html carrying no content: a crawler without JS, a link preview or an
// LLM fetcher got an empty page that also declared *itself* canonical. The meta
// refresh, the canonical and the visible link below are the server-rendered
// half of the same redirect. `<Redirect>` stays because it is instant in a real
// browser, and it wins the race in practice.
//
// The refresh target is deliberately RELATIVE: an absolute one built from
// siteConfig.url would send `docusaurus start` to production.
export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  const home = siteConfig.customFields?.docsHome;
  if (typeof home !== 'string') {
    // Unreachable in a built site: `npm run build` refuses to finish without it
    // (scripts/check-urls.mjs). This keeps `docusaurus start` honest.
    throw new Error('customFields.docsHome is missing from docusaurus.config.ts');
  }
  return (
    <>
      <Head>
        <title>Hortval Documentation</title>
        <meta
          name="description"
          content="Official documentation for Hortval, an on-premise ACME server for Microsoft ADCS."
        />
        <meta httpEquiv="refresh" content={`0; url=${home}`} />
        <link rel="canonical" href={siteConfig.url + home} />
      </Head>
      <main>
        <h1>Hortval Documentation</h1>
        <p>Official documentation for Hortval, an on-premise ACME server for Microsoft ADCS.</p>
        <p>
          <Link to={home}>Continue to the Hortval documentation</Link>
        </p>
      </main>
      <Redirect to={home} />
    </>
  );
}
