export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/Financial") {
      url.pathname = "/Financial/";
      return Response.redirect(url.toString(), 301);
    }

    const leaf = url.pathname.split("/").pop() ?? "";
    if (leaf.includes(".")) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const indexUrl = new URL("/Financial/index.html", url.origin);
    return env.ASSETS.fetch(new Request(indexUrl, { method: "GET" }));
  },
};
