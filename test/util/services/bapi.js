// BAPI service - Bitpaper API with exact terms and endpoints

// Helper to bind methods so they can call each other
function bind(obj, root) {
  root = root || obj
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'function') {
      obj[key] = obj[key].bind(root)
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      bind(obj[key], root)
    }
  })
  return obj
}

export function bapiService(baseURL) {
  const config = {
    env: 'test',
    actions: {
      auth: {
        login: function(credentials) {
          return this.fetch('bapi', '/user/login/email', {
            method: 'POST',
            body: credentials,
            skipAuth: true
          })
        },
        logout: function() {
          // Client-side only - no server endpoint needed
          localStorage.removeItem('loggedInUser')
          localStorage.removeItem('refreshToken')
          return Promise.resolve()
        },
        refresh: function() {
          const refreshToken = localStorage.getItem('refreshToken')
          return this.fetch('bapi', '/user/refresh', {
            method: 'POST',
            body: { refreshToken },
            skipAuth: true
          })
        },
        register: function(userData) {
          return this.fetch('bapi', '/user/signup', {
            method: 'POST',
            body: userData,
            skipAuth: true
          })
        }
      },
      paper: {
        save: function(id, data) {
          return this.fetch('bapi', '/user/papers/save', {
            method: 'POST',
            body: data
          })
        },
        list: function() {
          return this.fetch('bapi', '/user/papers')
        },
        get: function(id) {
          return this.fetch('bapi', `/papers/${id}`)
        },
        checkExists: function(url) {
          return this.fetch('bapi', '/user/saved-paper/exists', {
            method: 'POST',
            body: { url }
          })
        }
      },
      tags: {
        list: function() {
          return this.fetch('bapi', '/user/tags')
        },
        create: function(tag) {
          return this.fetch('bapi', '/user/tags', {
            method: 'POST',
            body: tag
          })
        },
        update: function(id, updates) {
          return this.fetch('bapi', `/tags/${id}`, {
            method: 'PATCH',
            body: updates
          })
        },
        delete: function(id) {
          return this.fetch('bapi', `/tags/${id}`, {
            method: 'DELETE'
          })
        }
      },
      preferences: {
        update: function(type, prefs) {
          return this.fetch('bapi', `/user/preferences/${type}`, {
            method: 'PATCH',
            body: prefs
          })
        }
      },
      assets: {
        getSignedUrl: function(paperId, assetKey) {
          return this.fetch('bapi', `/paper/${paperId}/assets/${assetKey}/signed-url`)
        }
      },
      rtc: {
        generateToken: function(paperId) {
          return this.fetch('bapi', `/paper/${paperId}/call/token`, {
            method: 'POST'
          })
        },
        getTwilioToken: function(sessionId) {
          return this.fetch('bapi', `/paper/${sessionId}/call/twilio`, {
            method: 'POST'
          })
        },
        getOpentokToken: function(sessionId) {
          return this.fetch('bapi', `/paper/${sessionId}/call/opentok`, {
            method: 'POST'
          })
        }
      }
    },
    services: {
      bapi: {
        base: {
          test: baseURL || 'http://localhost:9999/api',
          development: 'http://localhost:5100/api',
          staging: 'https://api-stage.bitpaper.io',
          production: 'https://api.bitpaper.io'
        }
      }
    }
  }
  
  // Bind all actions so methods can call each other
  config.actions = bind(config.actions)
  return config
}