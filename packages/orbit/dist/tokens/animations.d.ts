export declare const animationDelays: readonly ["50", "100", "200", "400", "800"];
export type AnimationDelay = (typeof animationDelays)[number];
export type AnimationProperties = {
    opacity?: number;
    translateX?: number;
    translateY?: number;
    scale?: number;
    rotate?: number;
};
export type AnimationEasing = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type AnimationToken = {
    from?: AnimationProperties;
    to?: AnimationProperties;
    duration: number;
    delay?: number;
    easing: AnimationEasing;
    repeat?: number | 'infinite';
    direction?: 'normal' | 'reverse' | 'alternate';
};
export declare const animations: {
    readonly 'slide-up': {
        readonly from: {
            readonly opacity: 0;
            readonly translateY: 12;
        };
        readonly to: {
            readonly opacity: 1;
            readonly translateY: 0;
        };
        readonly duration: 300;
        readonly easing: "ease-out";
    };
    readonly 'slide-left': {
        readonly from: {
            readonly opacity: 0;
            readonly translateX: 12;
        };
        readonly to: {
            readonly opacity: 1;
            readonly translateX: 0;
        };
        readonly duration: 300;
        readonly easing: "ease-out";
    };
    readonly 'fade-in': {
        readonly from: {
            readonly opacity: 0;
        };
        readonly to: {
            readonly opacity: 1;
        };
        readonly duration: 200;
        readonly easing: "ease-out";
    };
    readonly 'fade-out': {
        readonly from: {
            readonly opacity: 1;
        };
        readonly to: {
            readonly opacity: 0;
        };
        readonly duration: 150;
        readonly easing: "ease-in";
    };
    readonly 'slide-down': {
        readonly from: {
            readonly opacity: 0;
            readonly translateY: -12;
        };
        readonly to: {
            readonly opacity: 1;
            readonly translateY: 0;
        };
        readonly duration: 300;
        readonly easing: "ease-out";
    };
    readonly 'slide-right': {
        readonly from: {
            readonly opacity: 0;
            readonly translateX: -12;
        };
        readonly to: {
            readonly opacity: 1;
            readonly translateX: 0;
        };
        readonly duration: 300;
        readonly easing: "ease-out";
    };
    readonly 'scale-in': {
        readonly from: {
            readonly opacity: 0;
            readonly scale: 0.95;
        };
        readonly to: {
            readonly opacity: 1;
            readonly scale: 1;
        };
        readonly duration: 200;
        readonly easing: "ease-out";
    };
    readonly 'scale-out': {
        readonly from: {
            readonly opacity: 1;
            readonly scale: 1;
        };
        readonly to: {
            readonly opacity: 0;
            readonly scale: 0.95;
        };
        readonly duration: 150;
        readonly easing: "ease-in";
    };
    readonly pulse: {
        readonly from: {
            readonly opacity: 1;
        };
        readonly to: {
            readonly opacity: 0.5;
        };
        readonly duration: 1500;
        readonly easing: "ease-in-out";
        readonly repeat: "infinite";
        readonly direction: "alternate";
    };
};
export type AnimationName = keyof typeof animations;
