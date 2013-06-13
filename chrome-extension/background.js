chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.executeScript(null, {file:"jquery-1.10.1.min.js"}, function() {
        chrome.tabs.insertCSS(null, {file:"style.css"}, function() {
          chrome.tabs.executeScript(null, {file: "content.js"});
        });
      });
});