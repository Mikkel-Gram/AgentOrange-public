// Web Push Notifications Support
// Exposes push notification functions for Blazor JS interop.
// All functions return JSON-serializable values.

(function () {
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        const output = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) {
            output[i] = raw.charCodeAt(i);
        }
        return output;
    }

    function keysOf(subscription) {
        const json = subscription.toJSON();
        return { endpoint: subscription.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
    }

    window.agentOrangePush = {
        isSupported: function () {
            try {
                return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
            } catch {
                return false;
            }
        },

        getPermission: function () {
            try {
                if (!('Notification' in window)) {
                    return 'unsupported';
                }
                const permission = Notification.permission;
                return permission === 'granted' || permission === 'denied' || permission === 'default' 
                    ? permission 
                    : 'unsupported';
            } catch {
                return 'unsupported';
            }
        },

        getExistingSubscription: async function () {
            try {
                if (!('serviceWorker' in navigator)) {
                    return null;
                }
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (!subscription) {
                    return null;
                }
                return keysOf(subscription);
            } catch {
                return null;
            }
        },

        subscribe: async function (vapidPublicKey) {
            try {
                if (!('serviceWorker' in navigator)) {
                    return null;
                }

                const registration = await navigator.serviceWorker.ready;

                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    return null;
                }

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
                });

                return keysOf(subscription);
            } catch {
                return null;
            }
        },

        unsubscribe: async function () {
            try {
                if (!('serviceWorker' in navigator)) {
                    return true;
                }

                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                
                if (!subscription) {
                    return true;
                }

                await subscription.unsubscribe();
                return true;
            } catch {
                return false;
            }
        }
    };
})();
