export function isLinuxDesktop(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('linux') || userAgent.includes('x11');
}
