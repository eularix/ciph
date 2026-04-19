import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import React from 'react';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    table: (props: any) => (
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {React.createElement('table', props)}
      </div>
    ),
    pre: (props: any) => (
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {React.createElement('pre', props)}
      </div>
    ),
    code: (props: any) => (
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {React.createElement('code', props)}
      </div>
    ),
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
