chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.executeScript(null, {file:"jquery.js"}, function() {
        chrome.tabs.insertCSS(null, {file:"style.css"}, function() {
          chrome.tabs.executeScript(null, {file: "content.js"});
        });
      });
});