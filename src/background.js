"use strict";
// background.ts
// Allows users to open the side panel by clicking the action toolbar icon
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
chrome.runtime.onInstalled.addListener(() => {
    console.log('Echo extension installed');
});
//# sourceMappingURL=background.js.map