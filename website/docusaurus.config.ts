import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Hortval',
  tagline: 'ACME connector for your internal ADCS',
  favicon: 'img/favicon.ico',

  url: 'https://docs.hortval.com',
  baseUrl: '/',

  organizationName: 'hortval',
  projectName: 'hortval-docs',

  trailingSlash: false,
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

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        // The only documentation path that carried the product name. The
        // cross-domain move is handled at the CDN; this covers inbound links
        // that already reach the new host on the old path.
        redirects: [
          {
            from: '/intro/what-is-certeasy',
            to: '/intro/what-is-hortval',
          },
        ],
      },
    ],
  ],

  themeConfig: {
    // LE BANDEAU DE RENOMMAGE — il comble ce que la vitrine fait avec
    // `?from=certeasy`, et il le fait mieux ici.
    //
    // La vitrine déclenche une popup sur un paramètre ajouté par la règle de
    // redirection. Ce mécanisme ne convient pas à une documentation : on y
    // arrive par des liens PROFONDS — un signet, un résultat de recherche, un
    // lien collé dans un ticket — dont beaucoup ne passeront jamais par la
    // redirection qui pose le paramètre. Le bandeau, lui, s'affiche sur toutes
    // les pages, quelle que soit la porte d'entrée.
    //
    // `isCloseable` range le refus dans le stockage local du navigateur ;
    // changer l'`id` le fait réapparaître, ce qui est le seul moyen de
    // rediffuser un bandeau déjà écarté. À RETIRER quand le renommage aura
    // cessé d'être une nouvelle — quelques mois après la 0.9.5.
    announcementBar: {
      id: 'rename-certeasy-hortval-v2',
      // LA TAILLE EST EN STYLE INLINE, dans le contenu lui-même.
      //
      // `content` est injecté en HTML brut : un style posé ICI ne peut être
      // repris par rien — ni par `.content_xxxx { font-size: 85% }` du thème,
      // ni par une classe hashée qu'on ne peut pas prévoir, ni par une version
      // de thème différente de celle qu'on a sous les yeux. Trois tentatives en
      // CSS ont échoué sur exactement ces trois raisons.
      content:
        // LA TRANSITION, EN DEUX MARQUES CLAIRES.
        //
        // L'encre claire de Certeasy existe : c'est celle du bandeau sombre des
        // anciens courriers (`internal/mailer/assets/logo-black.png` côté
        // Site-Backend, retirée au renommage, retrouvée dans l'historique).
        // Les fichiers de l'époque étaient nommés d'après leur FOND, pas leur
        // encre — d'où « logo-black » pour la version claire. Sans elle il
        // aurait fallu des pastilles blanches ; avec, les deux marques vivent
        // directement sur l'indigo, ce qui est plus net.
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
      // Les couleurs passent par la CONFIG, pas par une feuille de style : le
      // composant les pose en style inline (`style={{backgroundColor, color}}`),
      // donc c'est le seul chemin qu'aucune règle du thème ne peut reprendre.
      backgroundColor: '#4f46e5',
      textColor: '#ffffff',
      isCloseable: true,
    },
    // LA CARTE D'APERÇU EST HÉBERGÉE PAR LA VITRINE, à dessein : un seul
    // fichier pour les deux sites, donc pas de copie à retoucher deux fois
    // quand le visuel change.
    //
    // Docusaurus la laisse telle quelle — `addBaseUrl` rend l'URL inchangée dès
    // qu'elle porte un protocole (vérifié dans @docusaurus/core), donc pas de
    // préfixage par docs.hortval.com.
    //
    // Ce chemin est stable PAR CONSTRUCTION : `Site/build.sh` en dépose une
    // copie brute à la racine de target/, hors de l'arbre fingerprinté, et le
    // commentaire à cet endroit-là dit pourquoi. Ne pas « corriger » en la
    // rapatriant dans static/img : ce serait revenir à deux fichiers qui
    // divergent.
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
