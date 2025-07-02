// ACME service - minimal generic service for testing core HttpBehavior functionality

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

export function acmeService(baseURL) {
  const config = {
    env: 'test',
    actions: {
      auth: {
        login: function(credentials) {
          return this.fetch('api', '/auth/login', {
            method: 'POST',
            body: credentials,
            skipAuth: true
          })
        },
        refresh: function() {
          return this.fetch('api', '/auth/refresh', {
            method: 'POST',
            skipAuth: true
          })
        }
      },
      resource: {
        save: function(data) {
          return this.fetch('api', '/resources', {
            method: 'POST',
            body: data
          })
        },
        list: function() {
          return this.fetch('api', '/resources')
        }
      }
    },
    services: {
      api: {
        base: {
          test: baseURL || 'http://localhost:9999/api'
        }
      }
    }
  }
  
  // Bind all actions so methods can call each other
  config.actions = bind(config.actions)
  return config
}