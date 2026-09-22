// Bloquea el scroll del fondo mientras hay un panel/visor abierto.
export const lockScroll = (open: boolean): void => {
  if (typeof document === "undefined") return;
  document.body.style.overflow = open ? "hidden" : "";
};