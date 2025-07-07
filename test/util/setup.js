import { JSDOM } from 'jsdom'

// Create a fresh JSDOM instance for each test file
export function createTestEnvironment() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://localhost:5001',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  })
  
  const window = dom.window
  
  // Set up globals needed by Polymer
  global.window = window
  global.document = window.document
  
  // Mock localStorage with proper implementation
  delete window.localStorage
  window.localStorage = createMockLocalStorage()
  
  // Mock Polymer.Base
  window.Polymer = {
    Base: createPolymerBase()
  }
  
  // Return cleanup function
  return () => {
    window.close()
    delete global.window
    delete global.document
  }
}

// Create mock localStorage that can be reset
export function createMockLocalStorage() {
  const storage = {
    _data: {},
    getItem(key) { 
      return this._data[key] || null 
    },
    setItem(key, value) { 
      this._data[key] = String(value)
    },
    removeItem(key) { 
      delete this._data[key] 
    },
    clear() { 
      this._data = {} 
    }
  }
  return storage
}

// Create Polymer.Base mock with common methods
export function createPolymerBase() {
  return {
    set(path, value) {
      const parts = path.split('.')
      let obj = this
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {}
        obj = obj[parts[i]]
      }
      obj[parts[parts.length - 1]] = value
    },
    
    fire(eventName, detail) {
      this._firedEvents = this._firedEvents || []
      this._firedEvents.push({ name: eventName, detail })
    },
    
    async(fn, delay) {
      return setTimeout(() => fn.call(this), delay || 0)
    },
    
    cancelAsync(handle) {
      if (handle) clearTimeout(handle)
    },
    
    getFiredEvents(eventName) {
      if (!eventName) return this._firedEvents || []
      return (this._firedEvents || []).filter(e => e.name === eventName)
    }
  }
}

// Create behavior instance with proper initialization
export function createBehaviorInstance(behavior, initialProps = {}) {
  const instance = Object.assign({}, createPolymerBase(), behavior, initialProps)
  // Initialize properties with default values
  if (behavior.properties) {
    Object.keys(behavior.properties).forEach(prop => {
      if (behavior.properties[prop].value && typeof behavior.properties[prop].value === 'function') {
        instance[prop] = behavior.properties[prop].value.call(instance)
      }
    })
  }
  
  return instance
}

// Create mock component for service tests
export function createMockComponent() {
  return {
    loading: false,
    lastError: null,
    lastResponse: null,
    firedEvents: [],
    set(prop, value) {
      this[prop] = value
    },
    fire(eventName, detail) {
      this.firedEvents.push({ name: eventName, detail })
    }
  }
}

// Common test setup pattern used across all test files
export function createTestSuite(testModule, options = {}) {
  const { buildApi = false, setupHook = null } = options
  
  let cleanup
  let server
  let behavior
  
  testModule.before(async () => {
    cleanup = createTestEnvironment()
    server = (await import('./server/index.js')).createTestServer()
    await server.start()
    
    if (setupHook) {
      await setupHook(server)
    }
  })
  
  testModule.after(async () => {
    await server?.stop()
    cleanup?.()
  })
  
  testModule.beforeEach(() => {
    window.localStorage.clear()
    behavior = createBehaviorInstance(globalThis.HttpBehavior)
    behavior.services = { bapi: { baseURL: server.host } }
    
    if (buildApi) {
      behavior._buildApi()
    }
  })
  
  return {
    getBehavior: () => behavior,
    getServer: () => server
  }
}
