// my-element.js - A minimal Polymer element

window.MyElement = {
  init: function() {
    console.log('MyElement initialized')
    return this
  }
}

// Initialize on load
if (typeof window !== 'undefined') {
  MyElement.init()
}