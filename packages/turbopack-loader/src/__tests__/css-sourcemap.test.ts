import fs from 'fs';
import os from 'os';
import path from 'path';

import { SourceMapConsumer } from 'source-map';

import type { Rules } from '@wyw-in-js/shared';

// eslint-disable-next-line import/no-relative-packages -- not part of the transform public API
import { extractCssFromAst } from '../../../transform/src/transform/generators/extract';

const transformMock = jest.fn();

jest.mock('@wyw-in-js/shared', () => ({
  __esModule: true,
  logger: jest.fn(),
}));

jest.mock('@wyw-in-js/transform', () => ({
  __esModule: true,
  TransformCacheCollection: class TransformCacheCollection {},
  transform: (...args: unknown[]) => transformMock(...args),
}));

const rules: Rules = {
  '.first': {
    className: 'first',
    displayName: 'First',
    cssText: '/* two\nlines */color:red;',
    start: { line: 3, column: 14 },
  },
  '.list': {
    className: 'list',
    displayName: 'List',
    cssText: '&:before,&:after{/* two\nlines */content:"a\\\nb";}',
    start: { line: 5, column: 13 },
  },
  '.atom': {
    atom: true,
    className: 'atom',
    displayName: 'Atom',
    cssText: '.atom,\n.atom:hover{color:green;}',
    start: { line: 6, column: 13 },
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
  try {
    consumer.eachMapping((mapping) => {
      lines[mapping.name] = mapping.generatedLine;
    });
  } finally {
    consumer.destroy();
  }
  return lines;
};

const lineNumber = (css: string, prefix: string) => {
  const index = css.split('\n').findIndex((line) => line.startsWith(prefix));
  if (index === -1) {
    throw new Error(`No line starts with ${prefix}`);
  }
  return index + 1;
};

const actualLines = (css: string) =>
  Object.fromEntries(
    Object.keys(rules).map((selector) => [
      selector,
      lineNumber(css, `:global(${selector}`),
    ])
  );

describe('turbopack-loader CSS source map', () => {
  beforeEach(() => {
    transformMock.mockReset();
  });

  it('points every mapping at the line where its rule starts', async () => {
    const { default: turbopackLoader } = await import('../index');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wyw-turbo-'));
    const resourcePath = path.join(tmpDir, 'entry.tsx');
    const configFile = path.join(tmpDir, 'wyw.config.js');
    fs.writeFileSync(resourcePath, 'export const x = 1;\n');
    fs.writeFileSync(configFile, 'module.exports = {};\n');

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
      turbopackLoader.call(
        {
          addDependency: jest.fn(),
          async: jest.fn(),
          callback: (err: Error | null) => (err ? reject(err) : resolve()),
          emitWarning: jest.fn(),
          getOptions: () => ({
            configFile,
            sourceMap: true,
            keepComments: true,
          }),
          getResolve: () => async () => false,
          resourcePath,
        } as any,
        fs.readFileSync(resourcePath, 'utf8'),
        null
      );
    });

    const css = fs.readFileSync(
      path.join(tmpDir, 'entry.wyw-in-js.module.css'),
      'utf8'
    );

    expect(await generatedLines(css)).toEqual(actualLines(css));
  });
});
