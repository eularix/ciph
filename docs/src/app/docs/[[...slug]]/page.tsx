import { getPageImage, getPageMarkdownUrl, source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-4xl font-bold mb-2">{page.data.title}</h1>
        {page.data.description && (
          <p className="text-lg text-muted-foreground">{page.data.description}</p>
        )}
      </div>
      <article className="prose dark:prose-invert max-w-none">
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </article>
    </div>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const pageImage = getPageImage(page);
  const pageUrl = `https://ciph.sh/docs/${page.slugs.join('/')}`;

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: 'article',
      title: page.data.title,
      description: page.data.description,
      url: pageUrl,
      siteName: 'Ciph',
      images: [
        {
          url: pageImage.url,
          width: 1200,
          height: 630,
          alt: page.data.title,
          type: 'image/png',
        },
      ],
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.data.title,
      description: page.data.description,
      images: [pageImage.url],
      creator: '@eularix',
    },
  };
}
