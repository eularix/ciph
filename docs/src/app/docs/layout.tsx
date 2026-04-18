import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { docsOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout 
      tree={source.getPageTree()} 
      sidebar={{
        defaultOpenLevel: 999,
        collapsible: false
      }} 
      {...docsOptions()}
      // className="mx-auto"
    >
      <div className="mx-auto max-w-4xl px-6 py-8">
        {children}
      </div>
    </DocsLayout>
  );
}
