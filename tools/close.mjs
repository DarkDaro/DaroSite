function timeout(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer.unref === "function") timer.unref();
  });
}

export async function closeBrowser(browser, limit = 5000) {
  if (!browser) return;
  await Promise.race([
    browser.close().catch(() => {}),
    timeout(limit)
  ]);
}

export async function closeServer(server, limit = 3000) {
  if (!server) return;
  if (typeof server.closeAllConnections === "function") server.closeAllConnections();
  if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
  await Promise.race([
    new Promise((resolve) => server.close(resolve)),
    timeout(limit)
  ]);
}
