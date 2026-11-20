import type { ReactNode } from "react";
import type { Property } from "csstype";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

interface SkeletonProps {
  width?: Property.Width | number;
  height?: Property.Height | number;
  boxHeight?: number;
  show?: boolean;
  pill?: boolean;
  rounded?: boolean;
  squared?: boolean;
  animated?: boolean;
  children?: ReactNode;
  className?: string;
}

export function Skeleton({ width, height, boxHeight, show = true, pill = false, rounded = false, squared = false, animated = true, children, className }: SkeletonProps) {
  return <span aria-hidden={!children} className={twMerge(clsx(
    "block rounded-[5px]",
    !children && show && "bg-skeleton-gradient bg-[length:400%_100%]",
    children && show && !width && !height && "relative after:absolute after:inset-0 after:rounded after:bg-skeleton-gradient after:bg-[length:400%_100%]",
    pill && "rounded-full after:rounded-full",
    rounded && "rounded-full after:rounded-full",
    squared && "rounded-none after:rounded-none",
    animated && !children && show && "animate-skeleton-loading",
    animated && children && show && "after:animate-skeleton-loading",
    className,
  ))} style={{ minHeight: height ?? 24, width: children ? "fit-content" : width, ...(boxHeight !== undefined ? { marginBottom: `calc(${boxHeight}px - ${typeof height === "number" ? height : 0}px)` } : {}) }}>{children}</span>;
}
