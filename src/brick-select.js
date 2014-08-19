/* global Platform */

(function () {

  var currentScript = document._currentScript || document.currentScript;
  var importDoc = currentScript.ownerDocument;

  var BrickSelectElementPrototype = Object.create(HTMLElement.prototype);

  // Lifecycle methods

  var TMPL_ROOT = 'template#brick-select-template';
  var TMPL_ITEM = 'template#brick-select-option-template';

  BrickSelectElementPrototype.createdCallback = function () {
    this.ns = { };

    var template = importDoc.querySelector(TMPL_ROOT);

    shimShadowStyles(template.content.querySelectorAll('style'),'brick-select');

    var shadowRoot = this.createShadowRoot();
    shadowRoot.appendChild(template.content.cloneNode(true));

    var title = this.getAttribute('title');
    if (title) {
      shadowRoot.querySelector('header h1').textContent = title;
    } else {
      shadowRoot.removeChild(shadowRoot.querySelector('header'));
    }

    shadowRoot.querySelector('button.handle span').textContent = title;

    var menu = shadowRoot.querySelector('ul.menu');
    var itemTemplateContent = importDoc.querySelector(TMPL_ITEM).content;

    var options = this.querySelectorAll('option');
    for (var i = 0; i < options.length; i++) {
      var option = options[i];
      var item = itemTemplateContent.cloneNode(true).querySelector('li');
      item.setAttribute('data-value', option.getAttribute('value'));
      item.querySelector('.label').innerHTML = option.innerHTML;
      menu.appendChild(item);
    }
  };

  BrickSelectElementPrototype.attachedCallback = function () {
    var self = this;
    var shadowRoot = this.shadowRoot;

    var inputs = this.ns.inputs = document.createElement('div');
    inputs.style.visibility = 'hidden';
    this.parentNode.insertBefore(inputs, this);

    this.updateProxy();

    shadowRoot.querySelector('button.handle')
      .addEventListener('click', function (ev) {
        self.show();
        ev.stopPropagation();
        ev.preventDefault();
      });

    shadowRoot.querySelector('button.close')
      .addEventListener('click', function (ev) {
        self.hide();
        ev.stopPropagation();
        ev.preventDefault();
      });

    shadowRoot.addEventListener('click', function (ev) {
      /*
      if (ev.target === self.shadowRoot.querySelector('.dialogue')) {
        return self.hide();
      }
      */
      return delegate('.menu-item', function (ev) {
        self.animateMenuItemClick(this, ev);
        if (self.hasAttribute('multiple')) {
          self.toggleSelected(this);
        } else {
          self.setSelected(this);
          self.hide();
        }
      })(ev);
    });

  };

  BrickSelectElementPrototype.detachedCallback = function () {
    this.ns.inputs.parentNode.removeChild(this.ns.inputs);
  };

  BrickSelectElementPrototype.attributeChangedCallback = function (attr, oldVal, newVal) {
    if (attr in attrs) {
      attrs[attr].call(this, oldVal, newVal);
    }
  };

  // Attribute handlers

  var attrs = {
  };

  // Custom methods

  BrickSelectElementPrototype.show = function (callback) {
    this.ns.callback = callback;

    var dialogue = this.shadowRoot.querySelector('.dialogue');
    dialogue.setAttribute('show', 'in');

    function animEnd () {
      this.removeEventListener('animationEnd', animEnd);
      this.removeEventListener('webkitAnimationEnd', animEnd);
      dialogue.setAttribute('show', '');
    }
    dialogue.querySelector('.panel').addEventListener('animationEnd', animEnd);
    dialogue.querySelector('.panel').addEventListener('webkitAnimationEnd', animEnd);
  };

  BrickSelectElementPrototype.hide = function () {
    this.ns.callback = null;

    var dialogue = this.shadowRoot.querySelector('.dialogue');
    dialogue.setAttribute('show', 'out');

    function animEnd (ev) {
      if (ev.target !== this) { return; }
      this.removeEventListener('animationEnd', animEnd);
      this.removeEventListener('webkitAnimationEnd', animEnd);
      dialogue.removeAttribute('show');
    }
    dialogue.addEventListener('animationEnd', animEnd, false);
    dialogue.addEventListener('webkitAnimationEnd', animEnd, false);
  };

  BrickSelectElementPrototype.setSelected = function (el) {
    this.clearSelected(false);
    el.setAttribute('selected', true);
    this.updateProxy();
  };

  BrickSelectElementPrototype.clearSelected = function (update) {
    var selected = this.shadowRoot.querySelectorAll('li[selected]');
    for (var i = 0; i < selected.length; i++) {
      selected[i].removeAttribute('selected');
    }
    if (update !== false) {
      this.updateProxy();
    }
  };

  BrickSelectElementPrototype.toggleSelected = function (el) {
    var sel = el.hasAttribute('selected');
    if (!sel) {
      el.setAttribute('selected', true);
    } else {
      el.removeAttribute('selected');
    }
    this.updateProxy();
  };

  BrickSelectElementPrototype.updateProxy = function () {
    var names = [];
    var inputs = this.ns.inputs;
    while (inputs.firstChild) {
      inputs.removeChild(inputs.firstChild);
    }
    var selected = this.shadowRoot.querySelectorAll('li[selected]');
    for (var i = 0; i < selected.length; i++) {
      var item = selected[i];
      var input = document.createElement('input');
      var attrs = {
        type: 'hidden',
        name: this.getAttribute('name'),
        value: item.getAttribute('data-value')
      };
      for (var k in attrs) {
        input.setAttribute(k, attrs[k]);
      }
      inputs.appendChild(input);
      names.push(item.querySelector('.label').textContent);
    }
    this.shadowRoot.querySelector('button.handle span').textContent = names.join(', ');
  };

  BrickSelectElementPrototype.animateMenuItemClick = function (item, ev) {
    var animate = this.shadowRoot.querySelector('.feedback.animate');
    if (animate) { animate.classList.remove('animate'); }

    var selected = item.querySelector('.feedback');
    if (selected) {
        var w = selected.parentNode.offsetWidth*2;
        selected.style.width = w+'px';
        selected.style.height = w+'px';
        selected.style.top = (w/2*-1)+(this.offsetHeight/2)+'px';
        selected.style.left = (ev.layerX-(w/2))+'px';
        selected.classList.add('animate');
    }
  };

  // Register the element

  window.BrickSelectElement = document.registerElement('brick-select', {
    prototype: BrickSelectElementPrototype
  });

  // Utility funcitons

  function shimShadowStyles(styles, tag) {
    if (!Platform.ShadowCSS) {
      return;
    }
    for (var i = 0; i < styles.length; i++) {
      var style = styles[i];
      var cssText = Platform.ShadowCSS.shimStyle(style, tag);
      Platform.ShadowCSS.addCssToDocument(cssText);
      style.remove();
    }
  }

  function delegate(selector, handler) {
    return function(e) {
      var target = e.target;
      var delegateEl = e.currentTarget;
      var matches = delegateEl.querySelectorAll(selector);
      for (var el = target; el.parentNode && el !== delegateEl; el = el.parentNode) {
        for (var i = 0; i < matches.length; i++) {
          if (matches[i] === el) {
            handler.call(el, e);
            return;
          }
        }
      }
    };
  }

})();