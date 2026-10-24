import { readFile, writeFile } from "node:fs/promises";

const requests = [];
globalThis.fetch = async (input) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  requests.push(url);
  await writeFile(
    process.env.VIDEO_ARTIFACT_REQUESTS,
    JSON.stringify(requests)
  );
  if (url === "https://api.github.com/repos/zxyycom/skills/releases/latest") {
    return Response.json({
      tag_name: "offline-video-artifact",
      html_url: "https://fixture.invalid/release",
      assets: [
        {
          name: "skill-release-manifest.json",
          url: "https://fixture.invalid/manifest"
        },
        {
          name: "video-understanding.zip",
          url: "https://fixture.invalid/archive"
        }
      ]
    });
  }
  if (url === "https://fixture.invalid/manifest")
    return new Response(await readFile(process.env.VIDEO_ARTIFACT_MANIFEST));
  if (url === "https://fixture.invalid/archive")
    return new Response(await readFile(process.env.VIDEO_SKILL_ARTIFACT));
  throw new Error(`Unexpected offline fixture request: ${url}`);
};
