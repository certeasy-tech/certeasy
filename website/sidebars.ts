import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Introduction',
      items: [
        'intro/what-is-certeasy',
        'intro/how-it-works',
        'intro/plans',
        'intro/roadmap',
      ],
    },
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/wizard',
        'getting-started/license',
        'getting-started/minimal-configuration',
        'getting-started/first-certificate',
      ],
    },
    {
      type: 'category',
      label: 'ACME Clients',
      items: [
        'clients/certbot',
        'clients/lego',
        'clients/acme-sh',
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      items: [
        'configuration/overview',
        'configuration/server',
        'configuration/tls',
        'configuration/database',
        'configuration/license',
        'configuration/dns-profiles',
        'configuration/issuance-policies',
        'configuration/policy-bindings',
        'configuration/authorities',
        'configuration/adcs',
        'configuration/workers',
        'configuration/rate-limiting',
        'configuration/renewal-info',
      ],
    },
    {
      type: 'category',
      label: 'Security',
      items: [
        'security/certificate-model',
        'security/dependencies',
        'security/hardening',
      ],
    },
    {
      type: 'category',
      label: 'Administration',
      items: [
        'administration/deployment-topology',
        'administration/logging',
        'administration/schema',
        'administration/migrations',
        'administration/backup',
        'administration/shutdown',
        'administration/audit',
        'administration/license-enforcement',
        'administration/antivirus-edr',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/faq',
        'reference/full-example',
        'reference/standards-compliance',
        'reference/test-coverage',
      ],
    },
    'upgrading',
    'changelog/index',
  ],
};

export default sidebars;
