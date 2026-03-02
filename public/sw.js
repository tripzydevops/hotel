const VERSION = 'v1.1.0'; // KAİZEN: Version bump to force update

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
                primaryKey: '2'
            },
            actions: [
                {
                    action: 'explore', title: 'View Report',
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

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((windowClients) => {
            // EXPLANATION: Robust URL Normalization
            // Browsers often treat 'site.com' and 'site.com/' as different strings.
            // We normalize both to ensure we find the existing dashboard tab.
            const normalize = (url) => url.replace(/\/$/, "");
            const targetUrl = origin + '/dashboard';
            const normalizedTarget = normalize(targetUrl);

            let matchingClient = null;

            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                const normalizedClientUrl = normalize(client.url);

                // Match if same origin (covers landing/login) or exact dashboard match
                if (new URL(client.url).origin === origin) {
                    matchingClient = client;
                    // If we find an exact match for dashboard, prioritize it
                    if (normalizedClientUrl === normalizedTarget) {
                        break;
                    }
                }
            }

            if (matchingClient) {
                // If it's already on the right page, just focus.
                // Otherwise, navigate it to the dashboard.
                if (normalize(matchingClient.url) !== normalizedTarget) {
                    return matchingClient.navigate(targetUrl).then(c => c.focus());
                }
                return matchingClient.focus();
            } else {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
