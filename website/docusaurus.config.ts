import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Certeasy',
  tagline: 'Connecteur ACME pour votre ADCS interne',
  favicon: 'img/favicon.ico',

  url: 'https://docs.certeasy.tech',
  baseUrl: '/',

  organizationName: 'certeasy',
  projectName: 'certeasy-docs',

  trailingSlash: false,
  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
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
          lastVersion: 'current',
          versions: {
            current: {
              label: 'Hortval 0.9.5',
              path: '/',
            },
            // What is frozen here is a binary, not a documentation number:
            // readers pick the version by the name of the binary they installed.
            // No banner: 0.9.4 is the current shipping release. Docusaurus
            // defaults every non-latest version to "no longer actively
            // maintained", which would announce an end of support nobody
            // decided.
            '0.9.4': {
              label: 'Certeasy 0.9.4',
              path: '0.9.4',
              banner: 'none',
            },
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

  themeConfig: {
    image: 'img/certeasy-social-card.jpg',
    colorMode: {
      defaultMode: 'light',
    },
    navbar: {
      title: 'Certeasy',
      logo: {
        alt: 'Certeasy Logo',
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
          href: 'https://certeasy.tech',
          label: 'Product site',
          position: 'right',
        },
        {
          href: 'https://github.com/certeasy-tech/certeasy/releases',
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
            {label: 'Official site', href: 'https://certeasy.tech'},
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
