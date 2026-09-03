import { SourceMapConsumer } from 'source-map';

import type { Rules } from '@wyw-in-js/shared';

// eslint-disable-next-line import/no-relative-packages -- not part of the transform public API
import { extractCssFromAst } from '../../../transform/src/transform/generators/extract';
import { getCacheInstance, toCacheKey } from '../cache';

const transformMock = jest.fn();

jest.mock('@wyw-in-js/shared', () => ({
  __esModule: true,
  logger: jest.fn(),
  mergeOxcResolverAlias: (oxcOptions: any) => oxcOptions,
  toNativeResolverAlias: () => ({}),
}));

jest.mock('@wyw-in-js/transform', () => ({
  __esModule: true,
  createFileReporter: () => ({
    emitter: { single: jest.fn() },
    onDone: jest.fn(),
  }),
  TransformCacheCollection: class TransformCacheCollection {},
  transform: (...args: unknown[]) => transformMock(...args),
  disposeEvalBroker: jest.fn(),
}));

const createHook = <TArgs extends unknown[]>() => {
  const handlers: Array<(...args: TArgs) => void> = [];

  return {
    call: (...args: TArgs) => {
      handlers.forEach((handler) => handler(...args));
    },
    tap: (_name: string, handler: (...args: TArgs) => void) => {
      handlers.push(handler);
    },
  };
};

const createCompiler = () => ({
  hooks: {
    done: createHook<[unknown]>(),
    failed: createHook<[Error]>(),
    shutdown: createHook<[]>(),
    watchClose: createHook<[]>(),
  },
  options: {},
});

const rules: Rules = {
  '.first': {
    className: 'first',
    displayName: 'First',
    cssText: '/* two\nlines */color:red;',
    start: { line: 3, column: 14 },
  },
  '.second': {
    className: 'second',
    displayName: 'Second',
    cssText: 'color:blue;',
    start: { line: 7, column: 15 },
  },
};

const marker = 'sourceMappingURL=data:application/json;base64,';

const generatedLines = async (css: string) => {
  const start = css.indexOf(marker) + marker.length;
  const end = css.indexOf('*/', start);
  const consumer = await new SourceMapConsumer(
    JSON.parse(Buffer.from(css.slice(start, end), 'base64').toString())
  );
  const lines: Record<string, number> = {};
  consumer.eachMapping((mapping) => {
    lines[mapping.name] = mapping.generatedLine;
  });
  consumer.destroy();
  return lines;
};

const actualLines = (css: string) =>
  Object.fromEntries(
    Object.keys(rules).map((selector) => [
      selector,
      css.split('\n').findIndex((line) => line.startsWith(selector)) + 1,
    ])
  );

describe('webpack-loader CSS source map', () => {
  beforeEach(() => {
    transformMock.mockReset();
  });

  it('points every mapping at the line where its rule starts', async () => {
    const { default: webpackLoader } = await import('../index');
    const resourcePath = '/abs/entry.tsx';
    const compiler = createCompiler();

    transformMock.mockImplementation(async (_services, code) => ({
      code,
      sourceMap: null,
      dependencies: [],
      ...extractCssFromAst(rules, '', {
        filename: resourcePath,
        keepComments: true,
      }),
    }));

    await new Promise<void>((resolve, reject) => {
      webpackLoader.call(
        {
          _compiler: compiler,
          addDependency: jest.fn(),
          async: jest.fn(),
          callback: (err: Error | null) => (err ? reject(err) : resolve()),
          context: process.cwd(),
          emitWarning: jest.fn(),
          getDependencies: () => [],
          getOptions: () => ({ sourceMap: true, keepComments: true }),
          getResolve: () =>
            jest.fn(
              (
                _ctx: string,
                _token: string,
                cb: (err: any, res: any) => void
              ) => cb(null, null)
            ),
          loaderIndex: 0,
          loaders: [{ ident: 'default' }],
          request: `/abs/webpack-loader.js??default!${resourcePath}`,
          resourcePath,
          rootContext: process.cwd(),
          utils: {
            contextify: (_ctx: string, request: string) => request,
          },
        } as any,
        'export const x = 1;',
        null
      );
    });

    const cache = await getCacheInstance(undefined, compiler);
    const css = String(await cache.get(toCacheKey(resourcePath)));

    expect(await generatedLines(css)).toEqual(actualLines(css));
  });
});
