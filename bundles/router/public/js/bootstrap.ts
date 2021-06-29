/* eslint-disable no-console */

// Require local dependencies
import qs from 'qs';
import Bar from 'nanobar';
import uuid from 'shortid';
import store from 'core/public/js/store';
import socket from 'socket/public/js/bootstrap';
import { EventEmitter } from 'events';
import { createBrowserHistory } from 'history';

/**
 * Build router class
 */
class EdenRouter extends EventEmitter {
  /**
   * Construct router class
   */
  constructor(...args) {
    // run super
    super(...args);

    // set mount
    this.__bar = false;
    this.__states = new Map();

    // create history
    this.history = createBrowserHistory();

    // build methods
    this.build = this.build.bind(this);

    // crud methods
    this.get = this.get.bind(this);
    this.put = this.put.bind(this);
    this.post = this.post.bind(this);
    this.delete = this.delete.bind(this);
    this.request = this.request.bind(this);

    // render methods
    this.render = this.render.bind(this);
    this.renderHead = this.renderHead.bind(this);

    // on methods
    this.onClick = this.onClick.bind(this);
    this.onSubmit = this.onSubmit.bind(this);

    // Bind methods
    this.go = this.go.bind(this);
    this.load = this.load.bind(this);
    this.submit = this.submit.bind(this);
    this.update = this.update.bind(this);

    // set max listeners
    this.setMaxListeners(0);

    // Run on document ready
    window.addEventListener('load', () => {
      // Get qs
      const id = uuid();
      const { hash } = window.location;
      const query = (window.location.pathname || '').split('?');

      // set state
      this.__states.set(id, {
        page  : store.get('page'),
        state : store.get('state'),
        mount : store.get('mount'),
      });

      // Push state
      this.history.replace({
        hash,
        search   : (query[1] ? `?${query[1]}` : ''),
        pathname : store.get('mount.url'),
      }, {
        state : id,
      });

      // Initialize
      this.building = this.build();
    });
  }


  // ////////////////////////////////////////////////////////////////////////////
  //
  // BUILD METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * Initialize functionality
   */
  async build() {
    // create bar element
    this.__bar = new Bar();

    // listen to go
    store.on('router.go', this.go);

    // on state
    socket.on('state', this.update);

    // on initialize
    await store.hook('initialize', store, (state) => {
      // mount
      store.emit('initialize', state);
    });

    // Pre user
    store.pre('set', (data) => {
      // Check key
      if (data.key !== 'router') return;

      // Set val
      data.val = this;
    });

    // private funciton to extract target
    const extractTarget = (e, type) => {
      // get target
      let { target } = e;

      // find closest A
      while (target && target.tagName !== type.toUpperCase()) {
        // get parent
        target = target.parentNode;

        // check parent
        if (!target) {
          // return no target
          return false;
        }
      }

      // return target
      return target;
    };

    // add listners
    document.addEventListener('click', e => this.onClick(extractTarget(e, 'a'), e));
    document.addEventListener('submit', e => this.onSubmit(extractTarget(e, 'form'), e));

    // On state change
    this.history.listen(this.render);
  }


  // ////////////////////////////////////////////////////////////////////////////
  //
  // CRUD METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * get url by parameters
   *
   * @param  {String} url
   * @param  {Object} opts
   *
   * @return {Promise}
   */
  get(url, opts = {}) {
    // return request
    return this.request('GET', url, opts);
  }

  /**
   * get url by parameters
   *
   * @param  {String} url
   * @param  {Object} opts
   *
   * @return {Promise}
   */
  put(url, opts = {}) {
    // return request
    return this.request('PUT', url, opts);
  }

  /**
   * get url by parameters
   *
   * @param  {String} url
   * @param  {Object} opts
   *
   * @return {Promise}
   */
  post(url, opts = {}) {
    // return request
    return this.request('POST', url, opts);
  }

  /**
   * get url by parameters
   *
   * @param  {String} url
   * @param  {Object} opts
   *
   * @return {Promise}
   */
  delete(url, opts = {}) {
    // return request
    return this.request('DELETE', url, opts);
  }

  /**
   * get url by parameters
   *
   * @param  {String} url
   * @param  {Object} opts
   *
   * @return {Promise}
   */
  async request(method, url, opts = {}) {
    // set data
    const request = {
      method,

      headers : {
        Accept : 'application/json',
      },
      redirect    : 'follow',
      credentials : 'same-origin',
    };

    // check url
    if (method.toLowerCase() === 'get' && Object.keys(opts).length) {
      // set data
      const data = url.includes('?') ? qs.parse(url.split('?')[1]) : {};

      // fix url
      url = url.includes('?') ? url.split('?')[1] : url;

      // stringify url
      url += `?${qs.stringify(Object.assign({}, data, opts))}`;
    } else if (method.toLowerCase() !== 'get') {
      // do body
      request.body = JSON.stringify(opts);

      // set JSON header
      request.headers['Content-Type'] = 'application/json';
    }

    // do fetch
    const res = await fetch(url, request);

    // Load json
    return await res.json();
  }


  // ////////////////////////////////////////////////////////////////////////////
  //
  // PROXY METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * Loads url
   *
   * @param  {String} url
   *
   * @returns {*}
   */
  async go(url) {
    // Progress bar
    this.__bar.go(50);

    // Check route
    if (url.includes('//') || url.indexOf('#') === 0) {
      // Timeout bar go
      setTimeout(() => {
        // Complete bar after 1 second
        this.__bar.go(100);
      }, 1000);

      // set window url
      window.location = url;

      // Return url
      return url;
    }

    // Create location
    this.history.push({
      pathname : url,
    });

    // time end
    const id = uuid();
    const time = (new Date()).getTime();

    // time
    console.time(`[${id}] [${url}] route`);

    // Run try/catch
    try {
      // loaded
      let loaded = null;

      // time
      console.time(`[${id}] [${url}] load`);

      // await on eden
      await store.hook('page.load', url, loaded, async () => {
        // time
        console.time(`[${id}] [${url}] fetch`);

        // Load json from url
        loaded = await this.get(url);

        // time
        console.timeEnd(`[${id}] [${url}] fetch`);
      });

      // time
      console.timeEnd(`[${id}] [${url}] load`);

      // time
      console.time(`[${id}] [${url}] render`);

      // await on eden
      await store.hook('page.render', loaded, () => {
        // Load json from url
        this.load(loaded);
      });
      store.emit('page.render', loaded);

      // time end
      console.timeEnd(`[${id}] [${url}] render`);

      // time
      console.timeEnd(`[${id}] [${url}] route`);

      // return time
      return (new Date()).getTime() - time;
    } catch (e) {
      // Log error
      setTimeout(() => {
        // Complete bar after 1 second
        this.__bar.go(100);
      }, 1000);

      // Redirect
      window.location = url;
    }

    // return url
    return url;
  }

  /**
   * Load data
   *
   * @param {Object} data
   */
  async load(data) {
    // Await hook
    await store.hook('load', data, (d) => {
      // Do event
      store.emit('load', d);
    });

    // set uuid
    const id = uuid();

    // set state
    this.__states.set(id, data);

    // Push state
    this.history.replace({
      pathname : data.mount.url,
    }, {
      state : id,
    });
  }

  /**
   * Submits form via ajax
   *
   * @param {HTMLElement} form
   */
  async submit(form) {
    // Get url
    let formUrl = form.getAttribute('action') || window.location.href.split(store.get('config').domain)[1];

    // Set request
    const formOpts = {
      method  : form.getAttribute('method') || 'POST',
      headers : {
        Accept : 'application/json',
      },
      redirect    : 'follow',
      credentials : 'same-origin',
    };

    // Set body
    if (formOpts.method.toUpperCase() === 'POST') {
      // Set to body
      formOpts.body = new FormData(form);
    } else {
      // Add to url
      formUrl += `?${jQuery(form).serialize()}`;
    }

    // Hook form
    await store.hook('submit', {
      url  : formUrl,
      opts : formOpts,
    }, ({ url, opts }) => {
      // Do trigger
      store.emit('submit', url, opts);
    });

    // Create location
    this.history.push({
      state    : '',
      pathname : formUrl,
    });

    // Run fetch
    const res = await fetch(formUrl, formOpts);

    // Run json
    this.load(await res.json());
  }

  /**
   * Updates page state
   *
   * @param  {Object} state
   */
  async update(state) {
    // set id
    const id = uuid();

    // set state
    this.__states.set(id, store.get('state'));

    // Let old
    const old = {
      state : {
        page  : store.get('page'),
        state : store.get('state'),
        mount : store.get('mount'),
      },
      pathname : store.get('mount').url,
    };

    // Check pathname
    if (old.pathname === state.url) {
      // Check url
      if (state.opts.mount && state.opts.mount.url) old.pathname = state.opts.mount.url;

      // Replace state object
      ['page', 'state', 'mount'].forEach((type) => {
        // Skip type
        if (!state.opts[type]) return;

        // Set in store
        Object.keys(state.opts[type]).forEach((key) => {
          // Update state
          old.state[type][key] = state.opts[type][key];
        });

        // Set state
        store.set('type', old.state[type]);
      });

      // Hook form
      await store.hook('state', old, (o) => {
        // Trigger state
        store.emit('state', o);
      });

      // set state as id
      old.state.state = id;

      // Push state
      this.history.replace(old);
    }
  }


  // ////////////////////////////////////////////////////////////////////////////
  //
  // RENDER METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * render page
   *
   * @param  {Object}  location
   *
   * @return {Promise}
   */
  async render({ location }) {
    // let state
    const state = location.state && location.state.state ? this.__states.get(location.state.state) : null;

    // check state
    if (!state) return;

    // Scroll to top
    if (!state.prevent && !location.state.prevent) {
      // scroll to 0
      window.scrollTo(0, 0);

      // Set progress go
      this.__bar.go(100);
    }

    // Check prevent
    if (state.prevent || location.state.prevent) return;

    // render title
    if (store.get('config').direction === 0) {
      document.title = (state.page.title ? `${state.page.title} | ` : '');
    } else if (store.get('config').direction === 1) {
      document.title = store.get('config').title + (state.page.title ? ` | ${state.page.title}` : '');
    } else {
      document.title = (state.page.title ? `${state.page.title} | ` : '') + store.get('config').title;
    }

    // Render header
    this.renderHead(state.page);

    // set value
    Object.keys(state).forEach((key) => {
      // Set data
      store.set(key, state[key]);
    });

    // Do layout
    await store.hook('layout', state, () => {
      // Emit events
      store.emit('layout', state);
    });

    // we do this as a seperate trigger to prevent double rendering
    await store.hook('route', {
      mount : state.mount,
      state : state.state,
    }, (data) => {
      // Emit events
      store.emit('route', data);
    });
  }

  /**
   * Replace head tags from state
   *
   * @param {Object} page
   *
   * @private
   */
  renderHead(page) {
    // Check head
    if (!page.head) return;

    // check elements that exist
    const oldHead = [];
    const mainNode = document.getElementById('eden-prehead');
    let preHead = mainNode;
    let newHead = document.createElement('template');

    // create shadow dom
    newHead.innerHTML = page.head;
    newHead = Array.from(newHead.content ? newHead.content.childNodes : newHead.childNodes);

    // set prehead
    preHead = preHead.nextElementSibling || preHead.nextSibling;

    // remove unwanted meta
    while (preHead.id !== 'eden-posthead') {
      // push to old head
      oldHead.push(preHead);

      // next prehead
      preHead = preHead.nextElementSibling || preHead.nextSibling;
    }

    // combined head
    const combinedHead = newHead.map((el) => {
      // find old item
      const found = oldHead.find((item) => {
        // return found
        return item.outerHTML.trim() === el.outerHTML.trim();
      });

      // return found
      if (found) return found;

      // return el
      return el;
    });

    // map to element
    for (let i = (combinedHead.length - 1); i >= 0; i -= 1) {
      // insert after
      const next = i === (combinedHead.length - 1) ? document.getElementById('eden-posthead') : combinedHead[i + 1];

      // after
      mainNode.parentNode.insertBefore(combinedHead[i], next);
    }

    // post head
    let postHead = combinedHead.shift();
    postHead = postHead.previousElementSibling || postHead.previousSibling;

    // remove elements
    while (postHead.id !== 'eden-prehead') {
      // get current
      const current = postHead;

      // next prehead
      postHead = postHead.previousElementSibling || postHead.previousSibling;

      // remove
      current.parentNode.removeChild(current);
    }
  }


  // ////////////////////////////////////////////////////////////////////////////
  //
  // ON METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * Redirects to url
   *
   * @param {HTMLElement} link
   * @param {Event}       e
   *
   * @return {Boolean}
   */
  onClick(link, e) {
    // return if no form
    if (!link || !link.getAttribute('href') || (link.getAttribute('href') || '').indexOf('#') === 0) return false;

    // check target
    if (link.getAttribute('target') || link.getAttribute('role')) return false;

    // get href
    let href = (link.getAttribute('href') || '');

    // set href
    href = href.indexOf(`https://${store.get('config.domain')}`) === 0 ? href.replace(`https://${store.get('config.domain')}`, '') : href;

    // Check if actual redirect
    if (href.includes('//') || href.indexOf('#') === 0) {
      // Return
      return false;
    }

    // Check file
    if (href.split('/').pop().split('.').length > 1) {
      // return false
      return false;
    }

    // Load next redirect
    this.go(href);

    // check e
    if (e) {
      // prevent default
      e.preventDefault();
      e.stopPropagation();
    }

    // Return true
    return true;
  }

  /**
   * Submits form via ajax
   *
   * @param {HTMLElement} form
   * @param {Event}       e
   *
   * @return {Boolean}
   */
  onSubmit(form, e) {
    // return if no form
    if (!form) return;

    // get href
    let href = (form.href || '');

    // set href
    href = href.indexOf(`https://${store.get('config.domain')}`) === 0 ? href.replace(`https://${store.get('config.domain')}`, '') : href;

    // prevent eden event
    if (form.getAttribute('data-eden') === 'prevent') {
      return;
    }

    // Check if actual redirect
    if (href.includes('//') || href.indexOf('#') === 0) {
      // Return
      return;
    }

    // Submit form
    this.submit(form);

    // check e
    if (e) {
      // prevent default
      e.preventDefault();
      e.stopPropagation();
    }
  }
}

// build eden router
const builtRouter = new EdenRouter();

// window
window.eden.router = builtRouter;

// export
export default builtRouter;
