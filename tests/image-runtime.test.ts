import { expect, it } from "vitest";
import sharp from "sharp";

it("processes an in-memory fixture with the upgraded native image dependency", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ffffff" } }).png().toBuffer();
  const metadata = await sharp(png).metadata();
  expect(metadata).toMatchObject({ format: "png", width: 2, height: 2 });
});
