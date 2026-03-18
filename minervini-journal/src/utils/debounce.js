/** Simple debounce for controlled inputs */
export function debounce(fn, ms) {
  let t;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
