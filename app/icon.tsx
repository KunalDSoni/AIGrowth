import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** OpenGrowth favicon — replaces the default Next.js "N" mark. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
          borderRadius: 8,
          color: "#fafafa",
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        O
      </div>
    ),
    { ...size },
  );
}
