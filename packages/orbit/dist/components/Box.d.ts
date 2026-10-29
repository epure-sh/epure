import React from 'react';
import type { BoxStyleProps } from '../utils/types';
type BoxElement = 'div' | 'span' | 'section' | 'article' | 'aside' | 'main' | 'nav' | 'header' | 'footer' | 'form' | 'fieldset' | 'label' | 'ul' | 'ol' | 'li';
type BoxOwnProps<E extends BoxElement = 'div'> = BoxStyleProps & {
    as?: E;
    className?: string;
    children?: React.ReactNode;
};
export type BoxProps<E extends BoxElement = 'div'> = BoxOwnProps<E> & Omit<React.ComponentPropsWithoutRef<E>, keyof BoxOwnProps<E>>;
export declare const Box: <E extends BoxElement = "div">(props: BoxProps<E> & {
    ref?: React.ForwardedRef<HTMLElement>;
}) => React.ReactElement | null;
export {};
