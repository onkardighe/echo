
const requestBtn = document.getElementById('request-btn');
const successMsg = document.getElementById('success-msg');

requestBtn?.addEventListener('click', async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        successMsg!.style.display = 'block';
        requestBtn!.style.display = 'none';
    } catch (err) {
        console.error(err);
        alert('Permission denied. Please allow microphone access in the browser address bar.');
    }
});
