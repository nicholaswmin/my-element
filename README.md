# poly-auth-behavior

![test](https://github.com/USERNAME/REPOSITORY/workflows/test/badge.svg)

Configurable HTTP service layer for [Polymer 1.x][polymer]

- Authentication by header injection & token refresh
- State management: `await api(element).user.save()`
  toggles `loading` & `lastError` on `element`.
- `<iron-ajax>`-compatible events and properties
- Calling `await api(element).user.get(14)` toggles 
  `loading` & `lastError` on `element`
- Per-environment config. management via `NODE_ENV`

## Usage

```javascript
behavior.apiConfig = {
  env: 'development',

  actions: {
    auth: {
      login: function(body) {
        return this.fetch('bapi', '/user/login/email', {
          method: 'POST', body, skipAuth: true
        });
      }
    },

    user: {
      save: function(data) {
        return this.fetch('bapi', '/user', {
          method: 'POST', body: data, skipAuth: true
        })  
      },
      
      get: function(id) {
        return this.fetch('bapi', `/user/${id}`)
      },
      
      // more domain methods, e.g: `list` or `remind`
    },
    
    account: {
      deposit: amount => {
        // logic...
      }
    }.
    
    // more domains, e.g: `account`
  },

  services: {
    bapi: {
      base: {
        development: 'http://localhost:5100/api',
        staging: 'https://stage.bitpaper.io',
        production: 'https://api.bitpaper.io/api'
      }
    },
    
    // add more services/microservices
  }
}
```

## Test

```bash
npm test
```

## License

The Bitpaper authors, 2025  
The [MIT License][license]

[license]: https://choosealicense.com/licenses/mit/
[polymer]: https://github.com/polymer/polymer
