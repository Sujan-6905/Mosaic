import { useEffect, useState } from "react";

export default function useViewportSize() {
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const measure = () => setSize({ width: window.innerWidth, height: window.innerHeight });
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);

    return size;
}
