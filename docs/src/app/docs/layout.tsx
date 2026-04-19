import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { docsOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      sidebar={{
        defaultOpenLevel: 999,
        collapsible: true,
      }}
      {...docsOptions()}
    >
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </div>
    </DocsLayout>
  );
}
