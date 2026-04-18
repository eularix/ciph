import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import { docsRoute, gitConfig } from './shared';

const NavLogo = () => (
  <span className="flex items-center">
    <Image
      src="/logo-white.svg"
      alt="Ciph"
      width={64}
      height={24}
      priority
    />
  </span>
);

export function docsOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <NavLogo />,
      transparentMode: 'always',
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}

export function pageOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <NavLogo />,
      transparentMode: 'always',
    },
    links: [
      {
        text: 'Docs',
        url: docsRoute,
        active: 'nested-url',
      },
      {
        text: 'Generate Key',
        url: '/generate-key',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}

export function baseOptions(): BaseLayoutProps {
  return docsOptions();
}
