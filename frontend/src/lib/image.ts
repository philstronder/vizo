// Downscales an image file and returns it as a compressed JPEG data URL.
// There's no object storage (S3) wired up yet, so images are carried as
// data URLs all the way through the API into a Postgres text column — fine
// for a demo at this size, but real deployments should upload to S3 and
// store the resulting object key/URL instead (see db/schema.sql).
export function fileToCompressedDataUrl(
  file: File,
  maxDimension = 1000,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image file"));
    };
    img.src = objectUrl;
  });
}

// Seed/demo listings carry a plain id or filename as their "image" so the
// placeholder icon has something stable to key off. Only data: and http(s):
// values are real, renderable images.
export function isRenderableImageSrc(src: string | undefined): src is string {
  return !!src && (src.startsWith("data:image/") || src.startsWith("http://") || src.startsWith("https://"));
}
