import type { PropsWithChildren, ReactNode } from 'react';
export interface SubnavProps extends PropsWithChildren {
    /** Accessible name for the navigation landmark. */
    label?: string;
}
/**
 * A horizontal row of links for switching between the sections of a page.
 * Compose with `SubnavItem`, passing your router's link element as the child.
 */
export declare const Subnav: ({ label, children }: SubnavProps) => import("react").JSX.Element;
export interface SubnavItemProps {
    /** Marks the item as the section currently shown (sets `aria-current`). */
    active?: boolean;
    /** The link element for the section; color and typography are inherited. */
    children: ReactNode;
}
export declare const SubnavItem: ({ active, children }: SubnavItemProps) => import("react").JSX.Element;
