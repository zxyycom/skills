const packageSection = /^\s*\[package\]\s*$/gm;
const nextSection = /^\s*\[/m;
const versionDeclaration = /^[ \t]*version[ \t]*=[^\r\n]*$/gm;
const packageVersion =
  /^[ \t]*version[ \t]*=[ \t]*"((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))"[ \t]*(?:#.*)?$/;

/** Extract the version from explicitly supplied crate source; formal builds pass a frozen snapshot. */
export function nativeRuntimeVersion(
  source: readonly { path: string; data: Uint8Array }[]
): string {
  const manifests = source.filter((file) => file.path === "Cargo.toml");
  if (manifests.length !== 1 || !manifests[0]) {
    throw new Error("native source must contain exactly one Cargo.toml");
  }
  const text = Buffer.from(manifests[0].data).toString("utf8");
  const sections = [...text.matchAll(packageSection)];
  if (sections.length !== 1 || sections[0]?.index === undefined) {
    throw new Error("invalid Cargo package section");
  }
  const body =
    text
      .slice(sections[0].index + sections[0][0].length)
      .split(nextSection, 1)[0] ?? "";
  const declarations = [...body.matchAll(versionDeclaration)];
  if (declarations.length !== 1 || !declarations[0]) {
    throw new Error("invalid Cargo package version");
  }
  const version = packageVersion.exec(declarations[0][0]);
  if (!version?.[1]) {
    throw new Error("invalid Cargo package version");
  }
  return version[1];
}
