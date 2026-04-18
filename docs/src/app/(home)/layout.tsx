import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { pageOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/'>) {
  return <HomeLayout {...pageOptions()}>{children}</HomeLayout>;
}
