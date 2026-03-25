"use client";

import { useEffect } from "react";

export default function ServiceWorkerProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => {
                navigator.serviceWorker
                    .register("/sw.js")
                    .then((registration) => {
                        console.log("SW registered:", registration);

                        // EXPLANATION: Immediate Update Check
                        // We want to ensure that if sw.js changed, the browser detects 
                        // and installs the new version immediately on page load, 
                        // rather than waiting for the next background check.
                        registration.update();
                    })
                    .catch((registrationError) => {
                        console.log("SW registration failed: ", registrationError);
                    });
            });
        }
    }, []);

    return <>{children}</>;
}
