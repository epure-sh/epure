export interface TextAreaProps extends React.ComponentProps<'textarea'> {
    resizable?: boolean | undefined;
}
declare const TextArea: {
    ({ ref, resizable, className, ...props }: TextAreaProps): import("react").JSX.Element;
    displayName: string;
};
export { TextArea };
