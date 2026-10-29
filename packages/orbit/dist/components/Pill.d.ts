import type { ReactNode } from 'react';
export type PillColor = 'gray' | 'blue' | 'purple' | 'yellow' | 'red' | 'green';
export interface PillProps {
    children: ReactNode;
    color: PillColor;
    className?: string;
}
export declare const Pill: ({ children, color, className }: PillProps) => import("react").JSX.Element;
