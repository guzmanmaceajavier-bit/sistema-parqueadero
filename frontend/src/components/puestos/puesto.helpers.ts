export function getZonaColor(zona) {
  if (!zona) return null;
  return `hsl(${(zona.length * 60 + zona.charCodeAt(0) * 30) % 360}, 55%, 45%)`;
}

export function combinarTipos(seleccionados, otros) {
  const otrosArr = otros.split(",").map(t => t.trim()).filter(Boolean);
  return [...new Set([...seleccionados, ...otrosArr])];
}
