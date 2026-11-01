import * as React from "react";

/**
 * Creates a component that supports both:
 * 1. Radix UI Slot / forwardRef ref forwarding (has `$$typeof = Symbol.for('react.forward_ref')` and `render`).
 * 2. Direct function invocation in unit tests (e.g. `DropdownMenuContent({ className: "..." })`).
 */
export function makeForwardRef<T, P extends object>(
  render: (props: P, ref: React.ForwardedRef<T>) => React.ReactElement | null,
): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<T>> &
  ((props: P) => React.ReactElement | null) {
  const comp = function (props: P) {
    return render(props, (((props as Record<string, unknown>)?.ref ?? null) as React.ForwardedRef<T>));
  };
  (comp as unknown as Record<string, unknown>)["$$typeof"] = Symbol.for("react.forward_ref");
  (comp as unknown as Record<string, unknown>).render = render;
  return comp as unknown as React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<T>> &
    ((props: P) => React.ReactElement | null);
}
