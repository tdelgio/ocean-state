import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#082838",
          color: "#8ce8ed",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            border: "6px solid #8ce8ed",
            borderRadius: "50%",
            display: "flex",
            flexDirection: "column",
            height: 116,
            justifyContent: "center",
            width: 116,
          }}
        >
          <div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: 0 }}>≈</div>
          <div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: 0, marginTop: -30 }}>≈</div>
        </div>
      </div>
    ),
    size,
  );
}
