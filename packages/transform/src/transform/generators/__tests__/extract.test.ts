import type { Rules } from '@wyw-in-js/shared';

import { extractCssFromAst } from '../extract';

const filename = '/path/to/src/file.js';

const rule = (className: string, cssText: string, line: number) => ({
  className,
  displayName: className,
  cssText,
  start: { line, column: 0 },
});

// Generated lines are separated by ';' in the mappings string, so this yields
// the 1-based generated lines that carry a mapping.
const mappedLines = (sourceMapText: string) =>
  (JSON.parse(sourceMapText).mappings as string)
    .split(';')
    .flatMap((segment, index) => (segment ? [index + 1] : []));

describe('extractCssFromAst', () => {
  it('maps single-line rules to consecutive lines', () => {
    const rules: Rules = {
      '.a': rule('a', 'color: red;', 1),
      '.b': rule('b', 'color: blue;', 2),
    };

    const result = extractCssFromAst(rules, '', { filename });

    expect(result.cssText).toBe('.a{color:red;}\n.b{color:blue;}\n');
    expect(mappedLines(result.cssSourceMapText)).toEqual([1, 2]);
  });

  it('accounts for multi-line comments kept in a rule', () => {
    const rules: Rules = {
      '.a': rule('a', '/* one\n   two */\ncolor: red;', 1),
      '.b': rule('b', 'color: blue;', 2),
      '.c': rule('c', 'color: green;', 3),
    };

    const result = extractCssFromAst(rules, '', {
      filename,
      keepComments: true,
    });

    expect(result.cssText).toBe(
      '.a{/* one\n   two */color:red;}\n.b{color:blue;}\n.c{color:green;}\n'
    );
    expect(mappedLines(result.cssSourceMapText)).toEqual([1, 3, 4]);
  });

  it('accounts for multi-line rules from the none preprocessor', () => {
    const rules: Rules = {
      '.a': rule('a', '\n  color: red;\n', 1),
      '.b': rule('b', 'color: blue;', 2),
    };

    const result = extractCssFromAst(rules, '', {
      filename,
      preprocessor: 'none',
    });

    expect(result.cssText).toBe(
      '.a {\n  color: red;\n}\n\n.b {color: blue;}\n\n'
    );
    expect(mappedLines(result.cssSourceMapText)).toEqual([1, 5]);
  });
});
