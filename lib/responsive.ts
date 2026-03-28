import { useWindowDimensions } from "react-native";

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const wRatio = width / BASE_WIDTH;
  const hRatio = height / BASE_HEIGHT;
  const ratio = Math.min(wRatio, hRatio);

  const scale = (size: number, min?: number, max?: number) => {
    const v = Math.round(size * wRatio);
    if (typeof min === "number" && typeof max === "number") return clamp(v, min, max);
    return v;
  };

  const vScale = (size: number, min?: number, max?: number) => {
    const v = Math.round(size * hRatio);
    if (typeof min === "number" && typeof max === "number") return clamp(v, min, max);
    return v;
  };

  const mScale = (size: number, factor = 0.5, min?: number, max?: number) => {
    const v = Math.round(size + (size * ratio - size) * factor);
    if (typeof min === "number" && typeof max === "number") return clamp(v, min, max);
    return v;
  };

  return { width, height, scale, vScale, mScale, ratio };
}
