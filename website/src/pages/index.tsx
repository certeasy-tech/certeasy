import { Redirect } from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

// The destination depends on which version is served at the root, so it is
// declared once in docusaurus.config.ts and read back here.
export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  const home = siteConfig.customFields?.docsHome;
  if (typeof home !== 'string') {
    // Unreachable in a built site: `npm run build` refuses to finish without it
    // (scripts/check-home-redirect.mjs). This keeps `docusaurus start` honest.
    throw new Error('customFields.docsHome is missing from docusaurus.config.ts');
  }
  return <Redirect to={home} />;
}
