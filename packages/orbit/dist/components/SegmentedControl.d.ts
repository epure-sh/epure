import { type VariantProps } from 'class-variance-authority';
declare const segmentedControlVariants: (props?: {
    size?: "sm" | "md" | "lg";
    variant?: "default" | "tabs";
} & import("class-variance-authority/types").ClassProp) => string;
interface SegmentedControlOption<T extends string> {
    value: T;
    label: string;
}
export interface SegmentedControlProps<T extends string> {
    options: SegmentedControlOption<T>[];
    value: T;
    onChange: (value: T) => void;
    size?: VariantProps<typeof segmentedControlVariants>['size'];
    variant?: VariantProps<typeof segmentedControlVariants>['variant'];
    className?: string;
}
export declare function SegmentedControl<T extends string>({ options, value, onChange, size, variant, className, }: SegmentedControlProps<T>): import("react").JSX.Element;
export {};
