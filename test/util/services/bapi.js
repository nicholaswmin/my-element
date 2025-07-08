export function bapiService(baseURL) {
  return {
    env: 'test',
    actions: {
      auth: {
        login: function(credentials) {
          return this.fetch('bapi', '/user/login/email', {
            method: 'POST',
            body: credentials
          })
        },

        logout: function() {
          localStorage.removeItem('loggedInUser')
          localStorage.removeItem('refreshToken')
          return Promise.resolve()
        },

        refresh: function() {
          const refreshToken = localStorage.getItem('refreshToken')
          return this.fetch('bapi', '/user/refresh', {
            method: 'POST',
            body: { refreshToken }
          })
        },

        register: function(userData) {
          return this.fetch('bapi', '/user/signup', {
            method: 'POST',
            body: userData
          })
        },

        resetPassword: function(email) {
          return this.fetch('bapi', '/user/password/forgot', {
            method: 'POST',
            body: { email }
          })
        },

        verifyEmail: function(token) {
          return this.fetch('bapi', '/user/email/verify', {
            method: 'POST',
            body: { token }
          })
        }
      },

      paper: {
        save: function(id, data) {
          return this.paper.get(id)
            .then(exists => exists
              ? this.paper.edit(id, data)
              : this.paper.add(id, data)
            )
        },

        list: function() {
          return this.fetch('bapi', '/user/papers')
        },

        get: function(id) {
          return this.fetch('bapi', `/paper/${id}`)
        },

        edit: function(id, data) {
          return this.fetch('bapi', `/paper/${id}`, {
            method: 'PATCH',
            body: data
          })
        },

        add: function(id, data) {
          return this.fetch('bapi', '/user/papers', {
            method: 'POST',
            body: data
          })
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
        getSignedUrl: function(paperId, key) {
          return this.fetch('bapi', `/paper/${paperId}/assets/${key}/signed-url`)
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
      },

      test: {
        slowOperation: function() {
          return this.fetch('bapi', '/test/slow')
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
}
