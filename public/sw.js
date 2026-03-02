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
    console.log('Notification click received. Action:', event.action);
    event.notification.close();

    // EXPLANATION: Handle 'close' action explicitly
    // If the user clicks the 'Close' button, we should just dismiss the notification
    // without opening or focusing any windows.
    if (event.action === 'close') {
        console.log('Notification closed by user action.');
        return;
    }

    // The base URL of the app
    const origin = self.location.origin;

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((windowClients) => {
            // EXPLANATION: Enhanced Tab Deduplication & Navigation
            // We search for any tab open on the same origin. 
            // If found, we navigate it to /dashboard (if needed) and focus it.
            // This prevents duplicate tabs while ensuring the user sees the latest data.
            let matchingClient = null;

            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (new URL(client.url).origin === origin) {
                    matchingClient = client;
                    break;
                }
            }

            const targetUrl = origin + '/dashboard';

            if (matchingClient) {
                // If it's already focused and on the right page, just return.
                // Otherwise, navigate it to ensure we hit the dashboard.
                if (matchingClient.url !== targetUrl) {
                    return matchingClient.navigate(targetUrl).then(c => c.focus());
                }
                return matchingClient.focus();
            } else {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
