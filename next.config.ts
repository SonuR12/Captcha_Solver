import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "canvas", "sharp", "node-tesseract-ocr"],
};

export default nextConfig;
