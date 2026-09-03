import type { RawSourceMap } from 'source-map';
import { SourceMapConsumer, SourceMapGenerator } from 'source-map';

import type { LineDelta } from './css-modules';
import { remapGeneratedLine } from './css-modules';

export async function remapSourceMapLines(
  sourceMapText: string,
  lineDeltas: LineDelta[]
) {
  if (sourceMapText === '' || lineDeltas.length === 0) {
    return sourceMapText;
  }

  const raw: RawSourceMap = JSON.parse(sourceMapText);
  const consumer = await new SourceMapConsumer(raw);

  try {
    const generator = new SourceMapGenerator({
      file: raw.file,
      sourceRoot: raw.sourceRoot,
    });

    consumer.eachMapping((mapping) => {
      generator.addMapping({
        generated: {
          line: remapGeneratedLine(lineDeltas, mapping.generatedLine),
          column: mapping.generatedColumn,
        },
        ...(mapping.source === null
          ? {}
          : {
              source: mapping.source,
              original: {
                line: mapping.originalLine,
                column: mapping.originalColumn,
              },
              name: mapping.name ?? undefined,
            }),
      });
    });

    raw.sources.forEach((source) => {
      const content = consumer.sourceContentFor(source, true);
      if (content !== null) {
        generator.setSourceContent(source, content);
      }
    });

    return generator.toString();
  } finally {
    consumer.destroy();
  }
}
