import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
            border: "16px solid #8ce8ed",
            borderRadius: "50%",
            display: "flex",
            flexDirection: "column",
            height: 330,
            justifyContent: "center",
            width: 330,
          }}
        >
          <div style={{ display: "flex", fontSize: 112, fontWeight: 700, letterSpacing: 0 }}>≈</div>
          <div style={{ display: "flex", fontSize: 112, fontWeight: 700, letterSpacing: 0, marginTop: -76 }}>≈</div>
        </div>
      </div>
    ),
    size,
  );
}
