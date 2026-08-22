import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// Which version the site serves at its root.
//
// Flipped to 'current' on 2026-08-22, when 0.9.5 shipped: the root now serves
// Hortval 0.9.5, and 0.9.4 moves to /0.9.4/ with an "unmaintained" banner.
//
// `lastVersion`, both version entries, the homepage target and the client
// redirect all follow from this constant — one line to change, and
// scripts/check-urls.mjs checks the result against the generated files.
//
// (The assertion keeps the comparison below legal: TypeScript narrows a const
// to its initializer.)
type RootVersion = '0.9.4' | 'current';
const ROOT_VERSION = 'current' as RootVersion;
const SHIPPED = ROOT_VERSION === 'current';

const config: Config = {
  title: 'Hortval',
  tagline: 'ACME connector for your internal ADCS',
  favicon: 'img/favicon.ico',

  url: 'https://docs.hortval.com',
  baseUrl: '/',

  organizationName: 'hortval',
  projectName: 'hortval',

  trailingSlash: false,

  // Where `/` sends the visitor. `src/pages/index.tsx` is a runtime <Redirect>
  // to this path, so no build pass validates it: broken-link checking reads
  // markdown, and the redirect plugin only validates its own table.
  customFields: {
    docsHome: SHIPPED ? '/intro/what-is-hortval' : '/intro/what-is-certeasy',
  },

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          // Which version sits here is decided by ROOT_VERSION, at the top of
          // this file, along with everything else that depends on it.
          lastVersion: ROOT_VERSION,
          versions: {
            current: SHIPPED
              ? { label: 'Hortval 0.9.5' }
              : {
                  label: 'Hortval 0.9.5 (unreleased)',
                  path: 'next',
                  banner: 'unreleased' as const,
                  // Not indexed while unreleased: these pages duplicate the
                  // ones at the root and document commands no release ships.
                  noIndex: true,
                },
            // Versions are named after the binary, so readers can pick the one
            // they installed. No banner while it is the shipping release:
            // Docusaurus would otherwise mark it unmaintained, which it is not.
            '0.9.4': SHIPPED
              ? {
                  label: 'Certeasy 0.9.4',
                  path: '0.9.4',
                  banner: 'unmaintained' as const,
                  // Only the version at the root is indexed; superseded pages
                  // would compete with their own replacements. Still reachable
                  // through the version menu.
                  noIndex: true,
                }
              : { label: 'Certeasy 0.9.4', path: '/', banner: 'none' as const },
          },
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.7,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        // The identity page is the only one whose file name differs between the
        // two versions, so it is the only URL the swap moves. Until then its
        // source is a real page, and redirecting it would hide it.
        redirects: SHIPPED
          ? [{ from: '/intro/what-is-certeasy', to: '/intro/what-is-hortval' }]
          : [],
      },
    ],
  ],

  themeConfig: {
    // The rename notice. Docs are reached through deep links — a bookmark, a
    // search result, a URL pasted in a ticket — so it has to show on every page
    // rather than on one entry point.
    //
    // Dismissal is stored in the browser; changing the `id` brings it back for
    // everyone. Remove it once the rename stops being news.
    announcementBar: {
      id: 'rename-certeasy-hortval-v2',
      // Sizing is inline, inside the content: `content` is injected as raw HTML,
      // so a stylesheet rule would have to outrank the theme's own hashed class.
      content:
        // Both marks, light-ink versions, straight on the indigo background.
        '<span style="display:inline-flex;align-items:center;gap:.55rem;' +
        'vertical-align:-0.5rem;margin-right:.8rem">' +
        '<img src="/img/certeasy-mark-white.png" alt="" aria-hidden="true" ' +
        'style="height:1.5rem;width:auto;display:block;opacity:.75"/>' +
        '<span style="opacity:.6;font-size:1.1rem;line-height:1">&rarr;</span>' +
        '<img src="/img/logo-white.png" alt="" aria-hidden="true" ' +
        'style="height:1.5rem;width:auto;display:block"/>' +
        '</span>' +
        '<span style="display:inline-block;font-size:1.35rem;line-height:1.5;font-weight:600">' +
        'Certeasy is now <b>Hortval</b> — same product, same team, new name. ' +
        '<a href="https://hortval.com/certeasy" style="color:#fff;text-decoration:underline">What changed</a>' +
        '</span>',
      // Colours go through the config rather than CSS: the component applies
      // them inline, so nothing in the theme can override them.
      backgroundColor: '#4f46e5',
      textColor: '#ffffff',
      isCloseable: true,
    },
    // Social preview card, shared with the main site so a single file serves
    // both. Absolute on purpose: Docusaurus leaves URLs with a protocol
    // untouched. Not copied into static/img, which would be a second file to
    // keep in step.
    image: 'https://hortval.com/og-hortval-indigo.png',
    colorMode: {
      defaultMode: 'light',
    },
    navbar: {
      title: 'Hortval',
      logo: {
        alt: 'Hortval Logo',
        src: 'img/logo-black.png',
        srcDark: 'img/logo-white.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docsVersionDropdown',
          position: 'right',
        },
        {
          href: 'https://hortval.com',
          label: 'Product site',
          position: 'right',
        },
        {
          href: 'https://github.com/hortval/hortval/releases',
          label: 'Download',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'Quick Start', to: '/getting-started/installation'},
            {label: 'Configuration', to: '/configuration/overview'},
            {label: 'Full Example', to: '/reference/full-example'},
          ],
        },
        {
          title: 'Product',
          items: [
            {label: 'Official site', href: 'https://hortval.com'},
            {label: 'Plans & pricing', to: '/intro/plans'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Safe Pic Technologies. All rights reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'powershell'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
