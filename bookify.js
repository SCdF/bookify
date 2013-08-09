//@ sourceURL=bookify.js
window.bookify = {
  // "Global" settings config
  // This should be passed in at some point
  settings: {
    debug: false,
    token: "YOU-NEED-TO-SPECIFY-ONE-SILLY"
  },

  /*
    Concerned with retrieving parsable DOM objects for an article
  */
  readability: {
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
      $(allContent).find("*").filter(bookify.readability.isLeafNodeFilter).each(function() {
        filteredContent.append($(this).clone());
      });
      return filteredContent.children();
    },
    apiCallUrl: function(contentUrl) {
      return "https://readability.com/api/content/v1/parser?token=" + bookify.settings.token + "&url=" + contentUrl;
    },
    getContent: function(contentUrl, successFn, errorFn) {
      //FIXME change to map of params
      /* Slurps content from the given url and passes the first element to success */
      var apiCallUrl = bookify.readability.apiCallUrl(contentUrl);

      //console.log("Trying to load " + apiCallUrl);
      $.ajax({
        url: apiCallUrl,
        dataType: "json",
        success: function(results){
          //console.log("Loaded " + results.url);
          results.content = bookify.readability.extractContent($.parseHTML(results.content));

          successFn(results);
        },
        error: errorFn
      });
    }
  },

  /*
    Concerned with rendering cloned DOM data to the page.
  */
  renderer: {
    elementOffPage: function(element) {
      var elBottom = element.offset().top + element.height();
      var screenHeight = $(window).height();
      return (elBottom > screenHeight) ? true : false;
    },
    renderPageForward: function(element, surface) {
      /* Renders the page forwards, starting with the given element */
      var lastRendered = null;
      var aborted = false;

      var body = $("body");

      element.nextAll().addBack().each(function() {
        var pageElement = $(this).clone();
        surface.append(pageElement);
        if (bookify.renderer.elementOffPage(body)) {
          aborted = true;
          if (bookify.settings.debug) {
            pageElement.addClass('debug');
          } else {
            pageElement.remove();
          }
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

      var body = $("body");

      var pageTail = null;
      element.next().prevAll().each(function() {
        var pageElement = $(this).clone();

        if (! pageTail) pageTail = pageElement;

        surface.prepend(pageElement);
        if (bookify.renderer.elementOffPage(body)) {
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
  },

  /*
    Concerned with logic around rendering pages
  */
  controller: {
    updateProgressbar: function(progressbar, elements, currentEl) {
      var progress = currentEl.length == 0 ? elements.length : elements.index(currentEl);

      progressbar.progressbar("option", "value", progress);
    },

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
      var report = bookify.renderer.renderPageForward(pointer.pageHead, surface);

      // TEMP hack for when elements are too large to ever be rendered
      if (!report.lastRendered) {
        return bookify.controller.largeElementHack(pointer.pageHead, surface);
      }

      return {
        pageHead: report.firstRendered,
        nextPageHead: report.lastRendered.next()
      };
    },
    renderNextPage: function(pointer, surface) {
      if (pointer.nextPageHead.length == 0) {
        surface.effect("shake", {direction: "left", distance: 3});
        return pointer;
      }

      surface.empty();
      var report = bookify.renderer.renderPageForward(pointer.nextPageHead, surface);

      // TEMP hack for when elements are too large to ever be rendered
      if (!report.lastRendered) {
        return bookify.controller.largeElementHack(pointer.nextPageHead, surface);
      }

      return  {
        pageHead: report.firstRendered,
        nextPageHead: report.lastRendered.next()
      };
    },
    renderPreviousPage: function(pointer, surface) {
      var prevEl = pointer.pageHead.prev();
      if (prevEl.length == 0) {
        surface.effect("shake", {direction: "right", distance: 3});
        return pointer;
      }

      surface.empty();
      var report = bookify.renderer.renderPageBackward(prevEl, surface);

      if (!report.aborted) {
        // Haven't run out of space yet, render forward as well
        var forwardReport = bookify.renderer.renderPageForward(report.firstRendered.next(), surface);
        if (forwardReport.lastRendered) {
          return  {
            pageHead: report.lastRendered,
            nextPageHead: forwardReport.lastRendered.next()
          };
        }
      } else if (!report.lastRendered) {
        // TEMP hack for when elements are too large to ever be rendered

        return bookify.controller.largeElementHack(prevEl, surface);
      }

      return  {
        pageHead: report.lastRendered,
        nextPageHead: report.firstRendered.next()
      };
    }
  }
};