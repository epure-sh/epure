import React, { FunctionComponent, type JSX } from 'react';
export interface InlineModalProps {
    isShown: boolean;
    hide: () => void;
    modalContent: JSX.Element | null;
    className?: string;
}
export declare const InlineModal: FunctionComponent<InlineModalProps>;
export declare const InlineModalHeader: (props: {
    children: React.ReactElement;
    className?: string;
    hide: () => void;
}) => JSX.Element;
