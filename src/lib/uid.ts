let counter = 0;
export function v4(): string {
  return `uid-${Date.now()}-${++counter}`;
}
