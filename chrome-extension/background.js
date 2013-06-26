chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.state == "loading") {
      chrome.browserAction.setIcon({path: "icon_48-LOADING.png"});
    } else if (request.state == "loaded") {
      chrome.browserAction.setIcon({path: "icon_48.png"});
    } else if (request.state == "error") {
      chrome.browserAction.setIcon({path: "icon_48-ERROR.png"});
    }

    sendResponse();
  }
);

chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.executeScript(null, {file:"libs.js"}, function() {
        chrome.tabs.insertCSS(null, {file:"style.css"}, function() {
          chrome.tabs.executeScript(null, {file: "content.js"});
        });
      });
});