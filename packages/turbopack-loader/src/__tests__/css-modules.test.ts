import { makeCssModuleGlobal } from '../css-modules';

describe('makeCssModuleGlobal', () => {
  it('wraps selectors in :global(...)', () => {
    expect(makeCssModuleGlobal('.a { color: red; }')).toBe(
      ':global(.a){ color: red; }'
    );
  });

  it('emits one rule per member of a selector list', () => {
    // lightningcss folds `:global(a), :global(b)` into `:is(a, b)`, which is
    // invalid with pseudo-elements and takes the specificity of the most
    // specific member; separate rules keep the source semantics
    expect(makeCssModuleGlobal('.a, .b{color:red}')).toBe(
      ':global(.a){color:red}\n:global(.b){color:red}'
    );
    expect(makeCssModuleGlobal('.a:before, .a:after{content:" ";c:red}')).toBe(
      ':global(.a:before){content:" ";c:red}\n:global(.a:after){content:" ";c:red}'
    );
    expect(makeCssModuleGlobal('.a, #b .c{c:red}')).toBe(
      ':global(.a){c:red}\n:global(#b .c){c:red}'
    );
  });

  it('splits selector lists inside @media blocks', () => {
    expect(
      makeCssModuleGlobal(
        '@media (min-width: 1px){.a::before, .a::after{c:red}}'
      )
    ).toBe(
      '@media (min-width: 1px){:global(.a::before){c:red}\n:global(.a::after){c:red}}'
    );
  });

  it('recurses into @media blocks', () => {
    expect(makeCssModuleGlobal('@media (min-width: 1px){.a{c:red}}')).toBe(
      '@media (min-width: 1px){:global(.a){c:red}}'
    );
  });

  it('keeps keyframes names untouched', () => {
    expect(makeCssModuleGlobal('@keyframes spin{from{a:0}to{a:1}}')).toBe(
      '@keyframes spin{from{a:0}to{a:1}}'
    );
  });

  it('keeps keyframes names untouched when used in animation', () => {
    expect(
      makeCssModuleGlobal(
        '.a{animation: spin 1s;}@keyframes spin{from{a:0}to{a:1}}'
      )
    ).toBe(':global(.a){animation: spin 1s;}@keyframes spin{from{a:0}to{a:1}}');
  });

  it('does not split on commas inside functions, attributes or strings', () => {
    expect(
      makeCssModuleGlobal('.a:is(.b, .c), [data-x="y,z"], .d:hover > .e{c:red}')
    ).toBe(
      ':global(.a:is(.b, .c)){c:red}\n:global([data-x="y,z"]){c:red}\n:global(.d:hover > .e){c:red}'
    );
  });
});
