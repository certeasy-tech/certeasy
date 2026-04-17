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
      ],
    },
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/license',
        'getting-started/minimal-configuration',
        'getting-started/first-certificate',
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
        'configuration/dns-profiles',
        'configuration/issuance-policies',
        'configuration/policy-bindings',
        'configuration/authorities',
        'configuration/workers',
      ],
    },
    {
      type: 'category',
      label: 'Security',
      items: [
        'security/certificate-model',
        'security/dependencies',
        'security/TODO',
      ],
    },
    {
      type: 'category',
      label: 'Administration',
      items: [
        'administration/logging',
        'administration/schema',
        'administration/migrations',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/full-configuration',
      ],
    },
    'changelog/index',
  ],
};

export default sidebars;
