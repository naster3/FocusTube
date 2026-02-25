import { useCallback, useEffect, useRef, useState } from "react";

export function useToast(timeoutMs = 2500) {
  const [toast, setToast] = useState("");
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setToast(""), timeoutMs);
    },
    [timeoutMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { toast, showToast };
}
