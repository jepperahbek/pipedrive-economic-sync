export function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="pipedrive-webhook"' },
  });
}

export function isAuthorized(
  request: Request,
  user?: string,
  password?: string,
): boolean {
  if (!user || !password) {
    return true;
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) {
    return false;
  }

  const decoded = atob(header.slice(6));
  const separator = decoded.indexOf(":");
  if (separator === -1) {
    return false;
  }

  const providedUser = decoded.slice(0, separator);
  const providedPassword = decoded.slice(separator + 1);
  return providedUser === user && providedPassword === password;
}
