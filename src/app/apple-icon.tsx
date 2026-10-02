import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#007aff" }}>
        <div style={{ width: 112, height: 78, borderRadius: 14, background: "#ffffff", display: "flex", flexDirection: "column" }}>
          <div style={{ marginTop: 16, height: 16, background: "#007aff" }} />
          <div style={{ marginTop: 16, marginLeft: 80, width: 16, height: 16, borderRadius: 8, background: "#007aff" }} />
        </div>
      </div>
    ),
    size,
  );
}
