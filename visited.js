export function getVisited() {
  if (typeof window === 'undefined') return [];
  const visited = localStorage.getItem('visitedStadiums');
  return visited ? JSON.parse(visited) : [];
}

export function toggleVisited(id) {
  const current = getVisited();
  let updated;
  if (current.includes(id)) {
    updated = current.filter((x) => x !== id);
  } else {
    updated = [...current, id];
  }
  localStorage.setItem('visitedStadiums', JSON.stringify(updated));
  return updated;
}