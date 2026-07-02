const POST_LOGOUT_REDIRECT_KEY = "sdlc-post-logout-redirect";

export function markPostLogoutRedirect(path = "/") {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(POST_LOGOUT_REDIRECT_KEY, path);
}

export function getPostLogoutRedirect() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(POST_LOGOUT_REDIRECT_KEY);
}

export function clearPostLogoutRedirect() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(POST_LOGOUT_REDIRECT_KEY);
}
