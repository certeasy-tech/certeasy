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

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          versions: {
            current: {
              label: 'v1 (actuelle)',
              path: '/',
            },
          },
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
            {label: 'Reference', to: '/reference/full-configuration'},
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
