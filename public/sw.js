const VERSION = 'v1.2.1'; // KAİZEN: Version bump to force update

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                url: data.url || '/dashboard/market-intelligence' // KAİZEN: Dynamic URL support
            },
            actions: [
                {
                    action: 'explore', title: 'View Details',
                    icon: '/checkmark.png'
                },
                {
                    action: 'close', title: 'Close',
                    icon: '/xmark.png'
                },
            ]
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    console.log(`[SW ${VERSION}] Notification click received. Action:`, event.action);
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    const origin = self.location.origin;
    const targetUrl = new URL(event.notification.data.url || '/dashboard', origin).href;

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((windowClients) => {
            // EXPLANATION: Aggressive Tab Matching
            // 1. Try to find any tab that is on the EXACT target URL.
            // 2. If not found, find any tab on the same origin (landing, dashboard, etc).

            let matchingClient = null;
            const normalize = (url) => url.replace(/\/$/, "");
            const normalizedTarget = normalize(targetUrl);

            // Attempt 1: Exact match
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (normalize(client.url) === normalizedTarget) {
                    matchingClient = client;
                    break;
                }
            }

            // Attempt 2: Same origin fallback (avoid opening new tabs if any part of the app is open)
            if (!matchingClient) {
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (new URL(client.url).origin === origin) {
                        matchingClient = client;
                        break;
                    }
                }
            }

            if (matchingClient) {
                // If it's already there (exact match), just focus.
                // If it's on the same origin but different page, navigate it.
                if (normalize(matchingClient.url) !== normalizedTarget) {
                    return matchingClient.navigate(targetUrl).then(c => c && c.focus());
                }
                return matchingClient.focus();
            } else {
                // No open tabs for this origin found, open a new one.
                return clients.openWindow(targetUrl);
            }
        })
    );
});
