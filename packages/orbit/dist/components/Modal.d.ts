import { FunctionComponent, type JSX } from 'react';
export interface ModalProps {
    title: string | JSX.Element;
    isShown: boolean;
    hide: () => void;
    modalContent: JSX.Element;
    className?: string;
}
export declare const Modal: FunctionComponent<ModalProps>;
