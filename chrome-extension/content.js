//@ sourceURL=content.js

/*
  Concerned with retrieving parsable DOM objects for an article
*/
var readability = {
  isLeafNodeFilter: function() {
    /* Where 'leaf' means a block level node with no block level children */

    var blockLevelElements = ["ADDRESS", "ARTICLE", "ASIDE", "AUDIO",
      "BLOCKQUOTE", "CANVAS", "DD", "DIV",
      "DL", "FIELDSET", "FIGCAPTION", "FIGURE",
      "FOOTER", "FORM", "H1", "H2", "H3",
      "H4", "H5", "H6", "HEADER", "HGROUP",
      "HR", "NOSCRIPT", "OL", "OUTPUT", "P", "PRE", "SECTION",
      "TABLE", "TFOOT", "UL", "VIDEO"];

    // Block level check
    if ($.inArray($(this).prop('tagName'), blockLevelElements) == -1) {
      return false;
    }

    // Children reverse block level check
    var isLeafNode = true;
    $(this).children().each(function() {
      if ($.inArray($(this).prop('tagName'), blockLevelElements) != -1) {
        isLeafNode = false;
        return false;
      }
    });

    /*
      TODO check for a node that we'd lose content on, e.g.
      <div>This would go<p>but this would stay</p></div>
      This includes more pernicious situations where we lose useful data,
      e.g. <blockquote><p>The blockquote node will be lost</p></blockquote>
    */

    return isLeafNode;
  },
  extractContent: function(allContent) {
    /* array of all the main content */

    var filteredContent = $("<div></div>");
    $(allContent).find("*").filter(readability.isLeafNodeFilter).each(function() {
      filteredContent.append($(this).clone());
    });
    return filteredContent.children();
  },
  token: "3f5c9f6c9869dbb23897ffe7c06f79ea4c1f1963",
  apiRoot: "https://readability.com",
  apiCallUrl: function(contentUrl) {
    return readability.apiRoot + "/api/content/v1/parser?url=" + contentUrl + "&token=" + readability.token;
  },
  getContent: function(contentUrl, successFn, errorFn) {
    //FIXME change to map of params
    /* Slurps content from the given url and passes the first element to success */
    var apiCallUrl = readability.apiCallUrl(contentUrl);

    //console.log("Trying to load " + apiCallUrl);
    $.ajax({
      url: apiCallUrl,
      dataType: "json",
      success: function(results){
        //console.log("Loaded " + results.url);
        results.content = readability.extractContent($.parseHTML(results.content));

        successFn(results);
      },
      error: errorFn
    });
  }
};

/*
  Concerned with rendering cloned DOM data to the page.
*/
var renderer = {
  elementOffPage: function(element) {
    var elBottom = element.offset().top + element.height();
    var screenHeight = $(window).height();
    // //console.log("El at " + elBottom + " of " + screenHeight);
    return (elBottom > screenHeight) ? true : false;
  },
  renderPageForward: function(element, surface) {
    /* Renders the page forwards, starting with the given element */
    var lastRendered = null;
    var aborted = false;

    element.nextAll().addBack().each(function() {
      var pageElement = $(this).clone();
      surface.append(pageElement);
      if (renderer.elementOffPage(surface)) {
        aborted = true;
        pageElement.remove();
        return false;
      } else {
        lastRendered = $(this);
      }
    });

    return {
      firstRendered: element,
      lastRendered: lastRendered,
      aborted: aborted
    };
  },
  renderPageBackward: function(element, surface) {
    /* Renders the page in reverse, starting with the given element. */
    var lastRendered = null;
    var aborted = false;

    var pageTail = null;
    element.next().prevAll().each(function() {
      var pageElement = $(this).clone();

      if (! pageTail) pageTail = pageElement;

      surface.prepend(pageElement);
      if (renderer.elementOffPage(surface)) {
        aborted = true;
        pageElement.remove();
        return false;
      } else {
        lastRendered = $(this);
      }
    });

    return {
      firstRendered: element,
      lastRendered: lastRendered,
      aborted: aborted
    };
  }
};

/*
  Concerned with logic around rendering pages
*/
var controller = {
  largeElementHack: function(el, surface) {
    //console.log("Element too large, forcing render");
    surface.append(el.clone());
    return {
      pageHead: el,
      nextPageHead: el.next()
    };
  },
  renderCurrentPage: function(pointer, surface) {
    surface.empty();
    var report = renderer.renderPageForward(pointer.pageHead, surface);

    // TEMP hack for when elements are too large to ever be rendered
    if (!report.lastRendered) {
      return controller.largeElementHack(pointer.pageHead, surface);
    }

    return {
      pageHead: report.firstRendered,
      nextPageHead: report.lastRendered.next()
    };
  },
  renderNextPage: function(pointer, surface) {
    if (pointer.nextPageHead.length == 0) {
      surface.effect("shake", {direction: "left", distance: 5});
      return pointer;
    }

    surface.empty();
    var report = renderer.renderPageForward(pointer.nextPageHead, surface);

    // TEMP hack for when elements are too large to ever be rendered
    if (!report.lastRendered) {
      return controller.largeElementHack(pointer.nextPageHead, surface);
    }

    return  {
      pageHead: report.firstRendered,
      nextPageHead: report.lastRendered.next()
    };
  },
  renderPreviousPage: function(pointer, surface) {
    var prevEl = pointer.pageHead.prev();
    if (prevEl.length == 0) {
      surface.effect("shake", {direction: "right", distance: 5});
      return pointer;
    }

    surface.empty();
    var report = renderer.renderPageBackward(prevEl, surface);

    if (!report.aborted) {
      // Haven't run out of space yet, render forward as well
      var forwardReport = renderer.renderPageForward(report.firstRendered.next(), surface);
      if (forwardReport.lastRendered) {
        return  {
          pageHead: report.lastRendered,
          nextPageHead: forwardReport.lastRendered.next()
        };
      }
    }

    return  {
      pageHead: report.lastRendered,
      nextPageHead: report.firstRendered.next()
    };
  }
};

function initBookify() {
  // TODO put this in a better place
  var pointer = {
    // The node at the top of the *current* page
    pageHead: null,
    // The node that will be at the top of the *next* page
    nextPageHead: null
  };

  // Nuke the current page from orbit
  window.onload = window.onunload = function() {};
  $("head").empty();
  $("body").empty();

  $("body").append("<div id='content'></div>");
  var surface = $('#content');

  $("#content").append("<h1>LOADING BRO...</h1>");

  readability.getContent(document.URL,
    function(results) {
      var title = $("<h1>").html(results.title);
      var combinedArticle = results.content.first().before(title).siblings();

      pointer = controller.renderCurrentPage({pageHead: combinedArticle.first()}, surface);

      //console.log("Initial render complete");
    },
    function(jqXHR, textStatus, errorThrown) {
      console.log("Something went wrong, error below the line!")
      console.log(textStatus, errorThrown);
      $("#content").append("<p>"+textStatus+"</p><p>"+errorThrown+"</p>");
    });

  $(document).keydown(function(e) {
    //TODO clean up, switch or something better
    if (e.keyCode == 39 || (!e.shiftKey && e.keyCode == 32)) {
      // Right or Space
      pointer = controller.renderNextPage(pointer, surface);
    } else if (e.keyCode == 37 || (e.shiftKey && e.keyCode == 32)) {
      // Left or Shift+Space
      pointer = controller.renderPreviousPage(pointer, surface);
    } else if (e.keyCode == 38) {
      // Up
      pointer = controller.renderCurrentPage({pageHead: pointer.pageHead.siblings().addBack().first()}, surface);
    } else {
      //console.log("Pressed " + e.keyCode);
    }
  });
  $(window).resize(function() {
    pointer = controller.renderCurrentPage(pointer, surface);
  });
};

initBookify();