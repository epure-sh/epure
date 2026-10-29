const passthrough = (value) => value;

export function create(styles) {
  return styles;
}

export function props() {
  return { className: "", style: {} };
}

export function defineVars(vars) {
  return vars;
}

export function defineConsts(consts) {
  return consts;
}

export function keyframes(frames) {
  return frames;
}

export const types = {};

export default {
  create,
  props,
  defineVars,
  defineConsts,
  keyframes,
  types,
};
