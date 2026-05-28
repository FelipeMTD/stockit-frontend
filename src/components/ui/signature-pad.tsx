'use client';

import { useEffect, useRef, useState } from 'react';

type SignaturePadProps = {
  value?: string | null;
  onChange: (value: string | null) => void;
  height?: number;
  disabled?: boolean;
};

function getCanvasPoint(
  event: PointerEvent | React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export default function SignaturePad({
  value,
  onChange,
  height = 220,
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const valueRef = useRef<string | null | undefined>(value);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const cssWidth = Math.max(1, Math.floor(rect.width));
    const cssHeight = height;

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    if (valueRef.current) {
      const img = new Image();

      img.onload = () => {
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
        hasDrawnRef.current = true;
      };

      img.src = valueRef.current;
    } else {
      hasDrawnRef.current = false;
    }

    setReady(true);
  };

  useEffect(() => {
    setupCanvas();

    const container = containerRef.current;

    if (!container) return;

    const observer = new ResizeObserver(() => {
      setupCanvas();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  useEffect(() => {
    if (!ready) return;

    setupCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ready]);

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;

    event.preventDefault();

    canvas.setPointerCapture(event.pointerId);

    const point = getCanvasPoint(event, canvas);

    isDrawingRef.current = true;
    hasDrawnRef.current = true;
    lastPointRef.current = point;

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;

    event.preventDefault();

    const point = getCanvasPoint(event, canvas);
    const lastPoint = lastPointRef.current;

    if (!lastPoint) {
      lastPointRef.current = point;
      return;
    }

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    lastPointRef.current = point;
  };

  const finishDrawing = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    if (event) {
      event.preventDefault();

      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // El pointer puede haber sido liberado ya.
      }
    }

    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    lastPointRef.current = null;

    if (hasDrawnRef.current) {
      onChange(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-white"
        style={{ height }}
      >
        {!value && !hasDrawnRef.current && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            Firma aquí
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={[
            'block w-full cursor-crosshair touch-none select-none bg-white',
            disabled ? 'cursor-not-allowed opacity-60' : '',
          ].join(' ')}
          style={{ height }}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          onPointerLeave={finishDrawing}
        />
      </div>
    </div>
  );
}