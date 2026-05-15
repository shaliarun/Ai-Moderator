import { randomUUID } from "crypto";
import { objectStorageClient } from "./objectStorage";

const HEYGEN_API_KEY = process.env.LIVEAVATAR_API_KEY ?? process.env.HEYGEN_API_KEY ?? "";
const HEYGEN_BASE = "https://api.heygen.com";

// User's personal instant avatar (arun kumar)
export const AVATAR_ID = "3be5547c0b2f4ad782a95616abfc4900";
// User's own voice clone (arun kumar)
export const VOICE_ID = "50595e4d2b47479c9c4f90b368a0939a";

async function heygenPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${HEYGEN_BASE}${path}`, {
    method: "POST",
    headers: {
      "X-Api-Key": HEYGEN_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HeyGen POST ${path} failed ${res.status}: ${text}`);
  }
  return res.json();
}

async function heygenGet(path: string): Promise<unknown> {
  const res = await fetch(`${HEYGEN_BASE}${path}`, {
    headers: { "X-Api-Key": HEYGEN_API_KEY },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HeyGen GET ${path} failed ${res.status}: ${text}`);
  }
  return res.json();
}

export async function submitVideoJob(text: string): Promise<string> {
  const data = await heygenPost("/v2/video/generate", {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: AVATAR_ID,
          avatar_style: "normal",
        },
        voice: {
          type: "text",
          input_text: text,
          voice_id: VOICE_ID,
        },
        background: {
          type: "color",
          value: "#0f0f11",
        },
      },
    ],
    dimension: { width: 512, height: 512 },
    aspect_ratio: "1:1",
  }) as { error: null | unknown; data: { video_id: string } };

  const d = data as { error: null | unknown; data: { video_id: string } };
  if (d.error) throw new Error(`HeyGen video error: ${JSON.stringify(d.error)}`);
  return d.data.video_id;
}

export async function getVideoStatus(
  videoId: string,
): Promise<{ status: "processing" | "completed" | "failed"; url?: string }> {
  const data = (await heygenGet(
    `/v1/video_status.get?video_id=${videoId}`,
  )) as { data: { status: string; video_url?: string } };
  const { status, video_url } = data.data;
  if (status === "completed" && video_url) {
    return { status: "completed", url: video_url };
  }
  if (status === "failed") return { status: "failed" };
  return { status: "processing" };
}

export async function waitForVideo(
  videoId: string,
  timeoutMs = 600_000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await getVideoStatus(videoId);
    if (result.status === "completed" && result.url) return result.url;
    if (result.status === "failed") return null;
    await new Promise((r) => setTimeout(r, 8_000));
  }
  return null;
}

export async function generateVideoForText(text: string): Promise<string | null> {
  const videoId = await submitVideoJob(text);
  return waitForVideo(videoId);
}

/**
 * Downloads a HeyGen signed video URL and stores it permanently in object
 * storage so it never expires. Returns the permanent serving path
 * e.g. `/objects/videos/<uuid>.mp4` (prepend `/api/storage` to get the URL).
 */
export async function mirrorVideoToStorage(heygenUrl: string): Promise<string> {
  const response = await fetch(heygenUrl);
  if (!response.ok) {
    throw new Error(`Failed to download HeyGen video: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const privateDir = process.env.PRIVATE_OBJECT_DIR ?? "";
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");

  const uuid = randomUUID();
  const fullPath = `${privateDir.startsWith("/") ? "" : "/"}${privateDir}/videos/${uuid}.mp4`;
  const parts = fullPath.split("/").filter((p, i) => i === 0 || p !== "");
  const bucketName = parts[1];
  const objectName = parts.slice(2).join("/");

  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(buffer, { contentType: "video/mp4", resumable: false });

  return `/objects/videos/${uuid}.mp4`;
}
