import { useEffect } from "react";

type KioskGuardProps = {
  children: React.ReactNode;
};

export default function KioskGuard({ children }: KioskGuardProps) {
  useEffect(() => {
    const preventDefault = (event: Event) => {
      event.preventDefault();
    };

    const preventWheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", preventDefault);
    document.addEventListener("gesturestart", preventDefault);
    document.addEventListener("gesturechange", preventDefault);
    document.addEventListener("gestureend", preventDefault);
    document.addEventListener("wheel", preventWheelZoom, { passive: false });

    const body = document.body;
    const previousUserSelect = body.style.userSelect;
    const previousWebkitUserSelect = (body.style as CSSStyleDeclaration & {
      webkitUserSelect?: string;
    }).webkitUserSelect;
    const previousTouchAction = body.style.touchAction;

    body.style.userSelect = "none";
    (body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = "none";
    body.style.touchAction = "none";

    let viewportMeta = document.querySelector(
      'meta[name="viewport"]'
    ) as HTMLMetaElement | null;
    const createdMeta = !viewportMeta;

    if (!viewportMeta) {
      viewportMeta = document.createElement("meta");
      viewportMeta.name = "viewport";
      document.head.appendChild(viewportMeta);
    }

    const previousViewportContent = viewportMeta.getAttribute("content");
    viewportMeta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    );

    return () => {
      document.removeEventListener("contextmenu", preventDefault);
      document.removeEventListener("gesturestart", preventDefault);
      document.removeEventListener("gesturechange", preventDefault);
      document.removeEventListener("gestureend", preventDefault);
      document.removeEventListener("wheel", preventWheelZoom);

      body.style.userSelect = previousUserSelect;
      (body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect =
        previousWebkitUserSelect;
      body.style.touchAction = previousTouchAction;

      if (viewportMeta) {
        if (createdMeta) {
          viewportMeta.remove();
        } else if (previousViewportContent) {
          viewportMeta.setAttribute("content", previousViewportContent);
        }
      }
    };
  }, []);

  return <div className="min-h-screen select-none">{children}</div>;
}
