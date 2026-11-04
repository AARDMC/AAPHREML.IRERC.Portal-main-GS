import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { GasAuthProvider } from "@/lib/gas/auth";
import { BRAND } from "@/lib/irerc/model";
import appCss from "../styles.css?url";

const APP_NAME = BRAND.title;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: BRAND.full,
      },
      { name: "theme-color", content: "#eef5ff" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/seal.png" },
      { rel: "apple-touch-icon", href: "/seal.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning data-theme="daylight">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('irerc-theme');var ok=['daylight','ocean','sand','midnight','graphite','forest','plum','rosewood'];if(t&&ok.indexOf(t)>-1){document.documentElement.dataset.theme=t}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <GasAuthProvider>
          <Outlet />
        </GasAuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
