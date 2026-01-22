// src/background.ts
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
chrome.runtime.onInstalled.addListener(() => {
  console.log("Echo extension installed");
});
//# sourceMappingURL=background.js.map
