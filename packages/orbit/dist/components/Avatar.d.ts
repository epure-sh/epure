import { ComponentProps } from 'react';
export interface AvatarProps {
    name: string;
    avatar_url: string | null;
    className?: string;
    height?: number | undefined;
    width?: number | undefined;
    loading?: React.ImgHTMLAttributes<HTMLImageElement>['loading'];
    CustomImageComponent?: React.ElementType;
}
declare const AvatarComponent: ({ name, avatar_url, className, height, width, loading, CustomImageComponent, }: AvatarProps) => import("react").JSX.Element;
export declare const Avatar: (props: ComponentProps<typeof AvatarComponent>) => import("react").JSX.Element;
export {};
