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
  if (!Array.isArray(raw.sources)) {
    return sourceMapText;
  }

  const consumer = await new SourceMapConsumer(raw);

  try {
    // The consumer reports sources already joined with sourceRoot.
    const generator = new SourceMapGenerator({ file: raw.file });

    consumer.eachMapping((mapping) => {
      if (mapping.source === null) {
        return;
      }
      generator.addMapping({
        generated: {
          line: remapGeneratedLine(lineDeltas, mapping.generatedLine),
          column: mapping.generatedColumn,
        },
        original: {
          line: mapping.originalLine,
          column: mapping.originalColumn,
        },
        source: mapping.source,
        name: mapping.name ?? undefined,
      });
    });

    consumer.sources.forEach((source) => {
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
