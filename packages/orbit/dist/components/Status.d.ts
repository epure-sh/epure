export type StatusColor = 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray';
export interface StatusProps {
    status: string;
    /** Applies a predefined color treatment. Omit for a neutral, color-less chip. */
    color?: StatusColor;
    size?: 'small' | 'medium';
}
export declare const Status: ({ status, color, size }: StatusProps) => import("react").JSX.Element;
