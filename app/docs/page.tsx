"use client";

import { useEffect } from "react";
import "swagger-ui-dist/swagger-ui.css";

export default function DocsPage() {
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const mod = await import("swagger-ui-dist/swagger-ui-bundle");
      if (!mounted) return;
      const SwaggerUIBundle = mod.default;
      SwaggerUIBundle({
        url: "/api/openapi",
        dom_id: "#swagger-ui",
        layout: "BaseLayout",
      });
    };

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main>
      <div id="swagger-ui" />
    </main>
  );
}
