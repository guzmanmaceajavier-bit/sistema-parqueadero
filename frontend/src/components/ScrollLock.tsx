import { useEffect } from "react";

export default function ScrollLock({ cuando }) {
  useEffect(() => {
    if (cuando) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [cuando]);
  return null;
}
