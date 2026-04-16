import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, docsRoute, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    links: [
      {
        text: 'Docs',
        url: docsRoute,
        active: 'nested-url',
      },
      {
        text: 'Generate Key',
        url: '/#generate-key',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
