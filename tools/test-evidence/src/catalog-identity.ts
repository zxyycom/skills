export const testEvidenceCaseHeadingPattern =
  /^### Case\s+([^\s:]+):\s+(\S.*)$/u;

export function testEvidenceCaseIdFromFirstLine(
  text: string,
  caseIdPattern: RegExp
): string | null {
  const lineFeedIndex = text.indexOf("\n");
  const firstLine = lineFeedIndex === -1
    ? text
    : text.slice(
      0,
      text[lineFeedIndex - 1] === "\r" ? lineFeedIndex - 1 : lineFeedIndex
    );
  const id = firstLine.includes("\r")
    ? undefined
    : firstLine.match(testEvidenceCaseHeadingPattern)?.[1];
  return id !== undefined && caseIdPattern.test(id) ? id : null;
}
