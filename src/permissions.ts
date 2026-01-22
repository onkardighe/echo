
const requestBtn = document.getElementById('request-btn');
const successMsg = document.getElementById('success-msg');

requestBtn?.addEventListener('click', async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        if (successMsg && requestBtn) {
            successMsg.style.display = 'block';
            requestBtn.style.display = 'none';
        }
        // Permission is now granted for the extension origin.
    } catch (err) {
        console.error(err);
        alert('Permission denied. Please allow microphone access in the browser address bar.');
    }
});
