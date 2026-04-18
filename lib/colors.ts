export function hueFromString(value: string | null | undefined): number {
  const input = (value ?? "").trim();
  if (input.length === 0) return 210;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = Math.abs(hash);
  return positive % 360;
}

export type BadgeStyle = {
  background: string;
  color: string;
  borderColor: string;
};

export function badgeStyleFor(key: string | null | undefined): BadgeStyle {
  const hue = hueFromString(key);
  return {
    background: `hsl(${hue} 55% 22% / 0.55)`,
    color: `hsl(${hue} 78% 82%)`,
    borderColor: `hsl(${hue} 45% 40% / 0.55)`,
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const component = (n: number) => {
    const value = lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${component(0)}${component(8)}${component(4)}`;
}

export function nodeColorFor(key: string | null | undefined): string {
  const hue = hueFromString(key);
  return hslToHex(hue, 70, 60);
}

export function accentColorFor(key: string | null | undefined): string {
  const hue = hueFromString(key);
  return `hsl(${hue} 82% 70%)`;
}
