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
      className="hidden dark:block"
      priority
    />
    <Image
      src="/logo-black.svg"
      alt="Ciph"
      width={64}
      height={24}
      className="block dark:hidden"
      priority
    />
  </span>
);

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <NavLogo />,
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
