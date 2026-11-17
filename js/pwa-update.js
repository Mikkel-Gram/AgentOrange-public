// PWA Update Mechanism
// Shows a non-blocking banner when a new service worker version is available.
// User clicks "Update" to skip waiting and reload the page with the new version.

(function() {
    let updateCheckTimer = null;
    let registration = null;
    let userAskedForUpdate = false;
    let reloading = false;

    async function checkForUpdates() {
        if (!registration) return;
        try {
            await registration.update();
        } catch (error) {
            console.error('PWA update check failed:', error);
        }
    }

    function showUpdateBanner() {
        const banner = document.getElementById('pwa-update-banner');
        if (!banner) return;
        
        banner.style.display = 'flex';
    }

    function hideUpdateBanner() {
        const banner = document.getElementById('pwa-update-banner');
        if (banner) {
            banner.style.display = 'none';
        }
    }

    function setupUpdateButton() {
        const updateBtn = document.getElementById('pwa-update-btn');
        if (!updateBtn) return;

        updateBtn.addEventListener('click', () => {
            if (registration?.waiting) {
                userAskedForUpdate = true;
                hideUpdateBanner();
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        });
    }

    function setupControllerChangeListener() {
        if (!navigator.serviceWorker) return;

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // Guard against a reload loop: controllerchange also fires the very first time a
            // worker takes control of an uncontrolled page, which is not an update.
            if (!userAskedForUpdate) return;
            if (reloading) return;
            reloading = true;
            location.reload();
        });
    }

    function monitorServiceWorker() {
        if (!registration) return;

        // A worker may already be sitting in 'waiting' from a previous visit, for instance if
        // the tab was closed before the banner was acted on. updatefound will never fire again
        // for that one, so check up front or the update is stranded forever.
        if (registration.waiting && navigator.serviceWorker.controller) {
            showUpdateBanner();
        }

        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // A new service worker is ready while one is controlling the page
                    showUpdateBanner();
                }
            });
        });
    }

    async function initPwaUpdates() {
        if (!navigator.serviceWorker) return;

        try {
            registration = await navigator.serviceWorker.ready;
        } catch (error) {
            console.error('Service worker registration failed:', error);
            return;
        }

        setupUpdateButton();
        setupControllerChangeListener();
        monitorServiceWorker();

        // Check for updates every 15 minutes
        checkForUpdates();
        updateCheckTimer = setInterval(checkForUpdates, 15 * 60 * 1000);

        // Also check when tab becomes visible
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkForUpdates();
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPwaUpdates);
    } else {
        initPwaUpdates();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (updateCheckTimer) {
            clearInterval(updateCheckTimer);
        }
    });
})();
