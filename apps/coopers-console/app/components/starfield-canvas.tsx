"use client";

import { useEffect, useMemo, useRef } from "react";

const STAR_COUNT = 300;
const STAR_TWINKLE_BASE_MS = 4200;

function getReducedMotionPreference() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function buildStarField() {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    radius: Math.random() * 1.7 + 0.25,
    opacity: Math.random() * 0.55 + 0.28,
    twinkleOffset: Math.random() * Math.PI * 2,
    twinkleSpeed: 0.55 + Math.random() * 1.2,
  }));
}

export function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stars = useMemo(buildStarField, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const drawingCanvas = canvas;
    const drawingContext = context;

    const reducedMotion = getReducedMotionPreference();
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    function resize() {
      pixelRatio = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      drawingCanvas.width = Math.floor(width * pixelRatio);
      drawingCanvas.height = Math.floor(height * pixelRatio);
      drawingCanvas.style.width = `${width}px`;
      drawingCanvas.style.height = `${height}px`;
      drawingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function draw(time: number) {
      drawingContext.clearRect(0, 0, width, height);
      drawingContext.fillStyle = "#020916";
      drawingContext.fillRect(0, 0, width, height);

      for (const star of stars) {
        const twinkle = reducedMotion
          ? 0.4
          : (Math.sin(
              time / (STAR_TWINKLE_BASE_MS / star.twinkleSpeed) +
                star.twinkleOffset,
            ) +
              1) /
            2;
        drawingContext.beginPath();
        drawingContext.fillStyle = `rgba(210, 244, 255, ${star.opacity * (0.45 + twinkle * 0.55)})`;
        drawingContext.arc(
          star.x * width,
          star.y * height,
          star.radius,
          0,
          Math.PI * 2,
        );
        drawingContext.fill();
      }

      animationFrame = window.requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [stars]);

  return <canvas aria-hidden="true" className="starfield" ref={canvasRef} />;
}