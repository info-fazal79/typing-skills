import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#16130f',
        }}
      >
        <span
          style={{
            fontSize: 108,
            fontWeight: 800,
            color: '#c1863f',
            fontFamily: 'sans-serif',
          }}
        >
          T
        </span>
      </div>
    ),
    { ...size }
  );
}
